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

type RunningScoutJob = QueuedScoutJob & {
  provider_response_id: string;
  provider_status: string | null;
  worker_stage: string | null;
};

function compactCounts(values: Record<string, number>) {
  return Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}:${count}`)
    .join(", ") || "none";
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

async function finishJob(job: QueuedScoutJob, result?: BackgroundScoutResult, errorMessage?: string) {
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

  const retry = job.attempt_count < job.max_attempts;
  await supabaseAdmin
    .from("ai_scout_runs")
    .update({
      status: retry ? "queued" : "failed",
      worker_stage: retry ? "queued" : "failed",
      provider_response_id: null,
      provider_status: null,
      claimed_at: null,
      started_at: retry ? null : undefined,
      completed_at: retry ? null : new Date().toISOString(),
      queued_at: retry ? new Date().toISOString() : undefined,
      last_error: errorMessage?.slice(0, 1000) || "AI Scout worker failed",
      notes: retry
        ? `Background worker attempt ${job.attempt_count} failed; mission returned to queue for retry.`
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

async function getRunningBackgroundJob(): Promise<RunningScoutJob | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id,location,category,attempt_count,max_attempts,provider_response_id,provider_status,worker_stage")
    .eq("status", "running")
    .not("queued_at", "is", null)
    .not("provider_response_id", "is", null)
    .order("claimed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RunningScoutJob | null;
}

async function pollRunningJob(job: RunningScoutJob) {
  const provider = await pollBackgroundScout(job.provider_response_id);

  if (provider.status === "queued" || provider.status === "in_progress") {
    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        provider_status: provider.status,
        worker_stage: "awaiting_openai",
        notes: `OpenAI background discovery is ${provider.status}; worker will poll again.`,
      })
      .eq("id", job.id);
    return NextResponse.json({
      success: true,
      pending: true,
      job_id: job.id,
      location: job.location,
      provider_status: provider.status,
      message: "AI Scout background discovery is still processing.",
    }, { status: 202 });
  }

  if (provider.status !== "completed") {
    const message = provider.error || `OpenAI background response ended with status ${provider.status}`;
    await finishJob(job, undefined, message);
    return NextResponse.json({ success: false, job_id: job.id, retrying: job.attempt_count < job.max_attempts, error: message }, { status: 500 });
  }

  if (!provider.outputText) {
    await finishJob(job, undefined, "AI Scout background response completed without output text");
    return NextResponse.json({ success: false, job_id: job.id, error: "AI Scout returned empty output." }, { status: 500 });
  }

  await supabaseAdmin.from("ai_scout_runs").update({ worker_stage: "finalizing", provider_status: "completed" }).eq("id", job.id);
  const result = await processBackgroundScoutOutput(job, provider.outputText);
  await finishJob(job, result);

  return NextResponse.json({
    success: true,
    pending: false,
    job_id: job.id,
    location: job.location,
    category: job.category,
    events_found: result.inserted,
    candidates: result.candidates,
    verification_tiers: result.verificationTiers,
    blocked_reasons: result.blockedReasons,
    duration_seconds: Math.round(result.durationMs / 1000),
    message: "AI Scout background mission completed.",
  });
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const running = await getRunningBackgroundJob();
    if (running) return await pollRunningJob(running);

    const { data: recovered, error: recoveryError } = await supabaseAdmin.rpc("requeue_stale_ai_scout_jobs", { p_stale_minutes: 2 });
    if (recoveryError) console.error("SCOUT QUEUE RECOVERY ERROR:", recoveryError);

    const { data, error: claimError } = await supabaseAdmin.rpc("claim_next_ai_scout_job");
    if (claimError) {
      console.error("SCOUT QUEUE CLAIM ERROR:", claimError);
      return NextResponse.json({ success: false, error: "Could not claim AI Scout job." }, { status: 500 });
    }

    const job = parseClaimedJob(data);
    if (!job) {
      return NextResponse.json({ success: true, idle: true, recovered: Number(recovered || 0), message: "No queued AI Scout mission is ready." });
    }

    try {
      const provider = await startBackgroundScout(job);
      await supabaseAdmin
        .from("ai_scout_runs")
        .update({
          provider_response_id: provider.id,
          provider_status: provider.status,
          worker_stage: "awaiting_openai",
          notes: `OpenAI background discovery started (${provider.status}).`,
        })
        .eq("id", job.id);

      return NextResponse.json({
        success: true,
        pending: true,
        job_id: job.id,
        location: job.location,
        category: job.category,
        attempt: job.attempt_count,
        provider_status: provider.status,
        recovered: Number(recovered || 0),
        message: "AI Scout background discovery started; worker will poll it on the next tick.",
      }, { status: 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start AI Scout background response";
      await finishJob(job, undefined, message);
      return NextResponse.json({ success: false, job_id: job.id, retrying: job.attempt_count < job.max_attempts, error: message }, { status: 500 });
    }
  } catch (error) {
    console.error("AI SCOUT STAGED WORKER ERROR:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "AI Scout worker failed" }, { status: 500 });
  }
}
