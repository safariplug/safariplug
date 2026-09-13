import { NextRequest, NextResponse } from "next/server";
import {
  pollBackgroundScout,
  processBackgroundScoutOutput,
  startBackgroundScout,
  type BackgroundScoutResult,
} from "@/app/admin/ai-scout/actions/process-queued-scout-background";
import type { QueuedScoutJob } from "@/app/admin/ai-scout/actions/process-queued-scout";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

// Two simultaneous web-search jobs give useful throughput without needlessly
// increasing the chance of hitting the account-wide OpenAI TPM ceiling.
const MAX_CONCURRENT_SCOUTS = 2;
const POLL_LEASE_SECONDS = 50;

type RunningScoutJob = QueuedScoutJob & {
  provider_response_id: string;
  provider_status: string | null;
  worker_stage: string | null;
};

type ProviderSnapshot = {
  job: RunningScoutJob;
  status: string;
  outputText: string;
  error: string | null;
};

function compactCounts(values: Record<string, number>) {
  return Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}:${count}`)
    .join(", ") || "none";
}

function transientProviderError(message: string) {
  const value = message.toLowerCase();
  return value.includes("rate limit")
    || value.includes("tokens per min")
    || value.includes("tpm")
    || value.includes("429")
    || value.includes("temporarily unavailable")
    || value.includes("server overloaded")
    || value.includes("timeout")
    || value.includes("timed out");
}

async function authorized(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;

  const vaultToken = request.headers.get("x-scout-worker-token");
  if (!vaultToken) return false;
  const { data, error } = await supabaseAdmin.rpc("verify_ai_scout_worker_token", { p_token: vaultToken });
  if (error) {
    console.error("SCOUT WORKER TOKEN VERIFY ERROR:", error);
    return false;
  }
  return data === true;
}

async function finishJob(
  job: QueuedScoutJob,
  result?: BackgroundScoutResult,
  errorMessage?: string,
  preserveAttempt = false,
) {
  if (result) {
    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "completed",
        worker_stage: "completed",
        provider_status: "completed",
        events_found: result.inserted,
        discoveries_found: result.candidates,
        sent_for_review: result.inserted,
        completed_at: new Date().toISOString(),
        claimed_at: null,
        poll_lease_until: null,
        last_error: null,
        notes: [
          `Background worker completed finalization in ${Math.round(result.durationMs / 1000)}s.`,
          `Candidates ${result.candidates}; inserted ${result.inserted}; blocked ${result.blocked}; source rejected ${result.sourceBlocked}; duplicates ${result.duplicates}.`,
          `Verification tiers: ${compactCounts(result.verificationTiers)}.`,
          `Candidate outcomes: ${compactCounts(result.blockedReasons)}.`,
        ].join(" "),
      })
      .eq("id", job.id);
    return;
  }

  const effectiveAttempts = preserveAttempt ? Math.max(0, job.attempt_count - 1) : job.attempt_count;
  const retry = preserveAttempt || effectiveAttempts < job.max_attempts;

  await supabaseAdmin
    .from("ai_scout_runs")
    .update({
      status: retry ? "queued" : "failed",
      worker_stage: retry ? "queued" : "failed",
      provider_response_id: null,
      provider_status: null,
      claimed_at: null,
      poll_lease_until: null,
      attempt_count: preserveAttempt ? effectiveAttempts : job.attempt_count,
      started_at: retry ? null : undefined,
      completed_at: retry ? null : new Date().toISOString(),
      queued_at: retry ? new Date().toISOString() : undefined,
      last_error: errorMessage?.slice(0, 1000) || "AI Scout worker failed",
      notes: retry
        ? preserveAttempt
          ? "Transient provider capacity/rate-limit error; mission returned to queue without consuming a retry attempt."
          : `Background worker attempt ${job.attempt_count} failed; mission returned to queue for retry.`
        : `Background worker attempt ${job.attempt_count} failed; retry limit exhausted.`,
    })
    .eq("id", job.id);
}

function parseClaimedJob(data: unknown): QueuedScoutJob | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Partial<QueuedScoutJob>;
  if (
    typeof row.id !== "string" ||
    typeof row.location !== "string" ||
    typeof row.category !== "string" ||
    typeof row.attempt_count !== "number" ||
    typeof row.max_attempts !== "number"
  ) return null;
  return row as QueuedScoutJob;
}

function parseLeasedJobs(data: unknown): RunningScoutJob[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is RunningScoutJob => Boolean(
    row &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    typeof row.location === "string" &&
    typeof row.category === "string" &&
    typeof row.attempt_count === "number" &&
    typeof row.max_attempts === "number" &&
    typeof row.provider_response_id === "string"
  ));
}

async function runningCount() {
  const { count, error } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("*", { count: "exact", head: true })
    .eq("status", "running")
    .not("queued_at", "is", null);
  if (error) throw error;
  return count || 0;
}

async function leaseRunningJobs() {
  const { data, error } = await supabaseAdmin.rpc("lease_ai_scout_running_jobs", {
    p_limit: MAX_CONCURRENT_SCOUTS,
    p_lease_seconds: POLL_LEASE_SECONDS,
  });
  if (error) throw error;
  return parseLeasedJobs(data);
}

async function snapshotProvider(job: RunningScoutJob): Promise<ProviderSnapshot> {
  try {
    const provider = await pollBackgroundScout(job.provider_response_id);
    return {
      job,
      status: provider.status || "unknown",
      outputText: provider.outputText,
      error: provider.error,
    };
  } catch (error) {
    return {
      job,
      status: "poll_error",
      outputText: "",
      error: error instanceof Error ? error.message : "Could not poll OpenAI background response",
    };
  }
}

async function releaseLease(jobId: string, updates: Record<string, unknown> = {}) {
  await supabaseAdmin
    .from("ai_scout_runs")
    .update({ ...updates, poll_lease_until: null })
    .eq("id", jobId);
}

async function updateWhileLeased(jobId: string, updates: Record<string, unknown>) {
  await supabaseAdmin
    .from("ai_scout_runs")
    .update(updates)
    .eq("id", jobId);
}

async function pollActivePool() {
  const leasedJobs = await leaseRunningJobs();
  if (!leasedJobs.length) return { polled: 0, finalized: null as string | null, pending: 0, failed: 0 };

  const snapshots = await Promise.all(leasedJobs.map(snapshotProvider));
  const completed: ProviderSnapshot[] = [];
  let pending = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    const { job, status } = snapshot;

    if (status === "queued" || status === "in_progress") {
      pending++;
      await releaseLease(job.id, {
        provider_status: status,
        worker_stage: "awaiting_openai",
        notes: `OpenAI background discovery is ${status}; worker will poll again.`,
      });
      continue;
    }

    if (status === "completed" && snapshot.outputText) {
      completed.push(snapshot);
      // Keep the polling lease while finalization is pending/in progress so an
      // overlapping worker invocation cannot finalize the same response twice.
      await updateWhileLeased(job.id, {
        provider_status: "completed",
        worker_stage: "finalizing",
        notes: "OpenAI discovery completed; SafariPlug is verifying sources.",
      });
      continue;
    }

    failed++;
    const message = snapshot.error || (
      status === "completed"
        ? "AI Scout background response completed without output text"
        : `OpenAI background response ended with status ${status}`
    );
    await finishJob(job, undefined, message, transientProviderError(message));
  }

  const nextCompleted = completed[0];
  if (nextCompleted) {
    try {
      const result = await processBackgroundScoutOutput(nextCompleted.job, nextCompleted.outputText);
      await finishJob(nextCompleted.job, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not finalize AI Scout output";
      await finishJob(nextCompleted.job, undefined, message, transientProviderError(message));
    }
  }

  return {
    polled: snapshots.length,
    finalized: nextCompleted?.job.id || null,
    pending,
    failed,
  };
}

async function claimAndStartOne() {
  const { data, error: claimError } = await supabaseAdmin.rpc("claim_next_ai_scout_job");
  if (claimError) throw claimError;

  const job = parseClaimedJob(data);
  if (!job) return null;

  try {
    const provider = await startBackgroundScout(job);
    const providerStatus = provider.status || "queued";
    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        provider_response_id: provider.id,
        provider_status: providerStatus,
        worker_stage: "awaiting_openai",
        poll_lease_until: null,
        notes: `OpenAI background discovery started (${providerStatus}).`,
      })
      .eq("id", job.id);

    return {
      job_id: job.id,
      location: job.location,
      category: job.category,
      attempt: job.attempt_count,
      provider_status: providerStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start AI Scout background response";
    await finishJob(job, undefined, message, transientProviderError(message));
    return null;
  }
}

async function fillOpenSlots() {
  const started: Array<{ job_id: string; location: string; category: string; attempt: number; provider_status: string }> = [];
  let active = await runningCount();

  while (active < MAX_CONCURRENT_SCOUTS) {
    const next = await claimAndStartOne();
    if (!next) break;
    started.push(next);
    active++;
  }

  return { active, started };
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: transientRecovered, error: transientRecoveryError } = await supabaseAdmin.rpc("requeue_transient_ai_scout_failures");
    if (transientRecoveryError) console.error("SCOUT TRANSIENT RECOVERY ERROR:", transientRecoveryError);

    const { data: recovered, error: recoveryError } = await supabaseAdmin.rpc("requeue_stale_ai_scout_jobs", {
      p_stale_minutes: 5,
    });
    if (recoveryError) console.error("SCOUT QUEUE RECOVERY ERROR:", recoveryError);

    const pool = await pollActivePool();
    const slots = await fillOpenSlots();

    return NextResponse.json({
      success: true,
      transient_recovered: Number(transientRecovered || 0),
      recovered: Number(recovered || 0),
      polled_jobs: pool.polled,
      finalized_job: pool.finalized,
      pending_provider_jobs: pool.pending,
      failed_provider_jobs: pool.failed,
      started_jobs: slots.started,
      concurrent_active: slots.active,
      max_concurrent: MAX_CONCURRENT_SCOUTS,
      idle: slots.active === 0,
      message: slots.active
        ? "AI Scout worker pool processed successfully."
        : "No queued or running AI Scout missions are ready.",
    }, { status: slots.active ? 202 : 200 });
  } catch (error) {
    console.error("AI SCOUT STAGED WORKER ERROR:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "AI Scout worker failed",
    }, { status: 500 });
  }
}
