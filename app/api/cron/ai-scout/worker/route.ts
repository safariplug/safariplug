import { NextRequest, NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ClaimedJob = {
  id: string;
  location: string;
  category: string;
  attempt_count: number;
  max_attempts: number;
};

async function finishJob(job: ClaimedJob, success: boolean, errorMessage?: string) {
  if (success) {
    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        claimed_at: null,
        last_error: null,
        notes: "Queued mission processed by the AI Scout worker. Discovery details are recorded in the execution run created by the Scout engine.",
      })
      .eq("id", job.id);
    return;
  }

  const retry = job.attempt_count < job.max_attempts;
  await supabaseAdmin
    .from("ai_scout_runs")
    .update({
      status: retry ? "queued" : "failed",
      queued_at: retry ? new Date().toISOString() : undefined,
      claimed_at: null,
      completed_at: retry ? null : new Date().toISOString(),
      last_error: errorMessage?.slice(0, 1000) || "AI Scout worker failed",
      notes: retry
        ? `Worker attempt ${job.attempt_count} failed; mission returned to queue for retry.`
        : `Worker attempt ${job.attempt_count} failed; retry limit exhausted.`,
    })
    .eq("id", job.id);
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

  if (recoveryError) {
    console.error("SCOUT QUEUE RECOVERY ERROR:", recoveryError);
  }

  const { data, error: claimError } = await supabaseAdmin.rpc("claim_next_ai_scout_job");

  if (claimError) {
    console.error("SCOUT QUEUE CLAIM ERROR:", claimError);
    return NextResponse.json({ success: false, error: "Could not claim AI Scout job." }, { status: 500 });
  }

  const job = (Array.isArray(data) ? data[0] : null) as ClaimedJob | null;
  if (!job) {
    return NextResponse.json({
      success: true,
      idle: true,
      recovered: Number(recovered || 0),
      message: "No queued AI Scout mission is ready.",
    });
  }

  const formData = new FormData();
  formData.append("location", job.location);
  formData.append("category", job.category);

  try {
    await runAIScout(formData);
    await finishJob(job, true);

    return NextResponse.json({
      success: true,
      idle: false,
      job_id: job.id,
      location: job.location,
      category: job.category,
      attempt: job.attempt_count,
      recovered: Number(recovered || 0),
      message: "AI Scout queued mission completed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Scout worker failed";
    console.error("AI SCOUT WORKER ERROR:", error);
    await finishJob(job, false, message);

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
