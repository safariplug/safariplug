import { NextRequest, NextResponse } from "next/server";
import { processQueuedScout, type QueuedScoutJob } from "@/app/admin/ai-scout/actions/process-queued-scout";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ScoutResult = {
  inserted: number;
  candidates: number;
  blocked: number;
  duplicates: number;
  sourceBlocked: number;
  verificationTiers: Record<string, number>;
  blockedReasons: Record<string, number>;
  durationMs: number;
};

function compactCounts(values: Record<string, number>) {
  return Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}:${count}`)
    .join(", ") || "none";
}

async function finishJob(
  job: QueuedScoutJob,
  result?: ScoutResult,
  errorMessage?: string,
) {
  if (result) {
    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "completed",
        events_found: result.inserted,
        discoveries_found: result.candidates,
        sent_for_review: result.inserted,
        completed_at: new Date().toISOString(),
        claimed_at: null,
        last_error: null,
        notes: [
          `Worker completed in ${Math.round(result.durationMs / 1000)}s.`,
          `Candidates ${result.candidates}; inserted ${result.inserted}; blocked ${result.blocked}; source rejected ${result.sourceBlocked}; duplicates ${result.duplicates}.`,
          `Verification tiers: ${compactCounts(result.verificationTiers)}.`,
          `Candidate outcomes: ${compactCounts(result.blockedReasons)}.`,
        ].join(" "),
      })
      .eq("id", job.id);
    return;
  }

  const retry = job.attempt_count < job.max_attempts;
  const update: Record<string, unknown> = {
    status: retry ? "queued" : "failed",
    claimed_at: null,
    completed_at: retry ? null : new Date().toISOString(),
    last_error: errorMessage?.slice(0, 1000) || "AI Scout worker failed",
    notes: retry
      ? `Worker attempt ${job.attempt_count} failed; mission returned to queue for retry.`
      : `Worker attempt ${job.attempt_count} failed; retry limit exhausted.`,
  };

  if (retry) update.queued_at = new Date().toISOString();

  await supabaseAdmin.from("ai_scout_runs").update(update).eq("id", job.id);
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
  ) {
    return null;
  }

  return row as QueuedScoutJob;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: recovered, error: recoveryError } = await supabaseAdmin.rpc(
    "requeue_stale_ai_scout_jobs",
    { p_stale_minutes: 10 },
  );

  if (recoveryError) console.error("SCOUT QUEUE RECOVERY ERROR:", recoveryError);

  const { data, error: claimError } = await supabaseAdmin.rpc("claim_next_ai_scout_job");

  if (claimError) {
    console.error("SCOUT QUEUE CLAIM ERROR:", claimError);
    return NextResponse.json({ success: false, error: "Could not claim AI Scout job." }, { status: 500 });
  }

  const job = parseClaimedJob(data);
  if (!job) {
    return NextResponse.json({
      success: true,
      idle: true,
      recovered: Number(recovered || 0),
      message: "No queued AI Scout mission is ready.",
    });
  }

  try {
    const result = await processQueuedScout(job);
    await finishJob(job, result);

    return NextResponse.json({
      success: true,
      idle: false,
      job_id: job.id,
      location: job.location,
      category: job.category,
      attempt: job.attempt_count,
      events_found: result.inserted,
      candidates: result.candidates,
      verification_tiers: result.verificationTiers,
      blocked_reasons: result.blockedReasons,
      duration_seconds: Math.round(result.durationMs / 1000),
      recovered: Number(recovered || 0),
      message: "AI Scout queued mission completed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Scout worker failed";
    console.error("AI SCOUT WORKER ERROR:", error);
    await finishJob(job, undefined, message);

    return NextResponse.json(
      {
        success: false,
        job_id: job.id,
        location: job.location,
        category: job.category,
        attempt: job.attempt_count,
        retrying: job.attempt_count < job.max_attempts,
        error: message,
      },
      { status: 500 },
    );
  }
}
