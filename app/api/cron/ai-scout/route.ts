import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authorizedCronRequest } from "@/lib/auth/cron-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await authorizedCronRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: runId, error } = await supabaseAdmin.rpc("enqueue_scheduled_ai_scout");
  if (error) {
    console.error("AI SCOUT SCHEDULE QUEUE ERROR:", error);
    return NextResponse.json({ success: false, error: "Could not queue scheduled AI Scout mission." }, { status: 500 });
  }

  if (!runId) {
    return NextResponse.json({
      accepted: true,
      queued: false,
      scheduled_day: false,
      message: "No AI Scout mission is scheduled today. Autonomous missions run Monday, Wednesday and Friday at 06:00 Africa/Nairobi.",
    });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id,location,category,status,queued_at,worker_stage,provider_status,notes")
    .eq("id", String(runId))
    .maybeSingle();

  if (jobError || !job) {
    console.error("AI SCOUT SCHEDULE LOOKUP ERROR:", jobError);
    return NextResponse.json({ success: false, error: "Scheduled mission was queued but could not be loaded." }, { status: 500 });
  }

  let wakeRequested = false;
  if (job.status === "queued") {
    const { error: wakeError } = await supabaseAdmin.rpc("invoke_ai_scout_worker");
    wakeRequested = !wakeError;
    if (wakeError) console.error("AI SCOUT SCHEDULE WORKER WAKE ERROR:", wakeError);
  }

  return NextResponse.json(
    {
      accepted: true,
      queued: job.status === "queued",
      run_id: job.id,
      location: job.location,
      category: job.category,
      status: job.status,
      worker_stage: job.worker_stage,
      provider_status: job.provider_status,
      worker_wake_requested: wakeRequested,
      message: `Autonomous AI Scout mission is ${job.status} for ${job.location} / ${job.category}.`,
    },
    { status: job.status === "queued" ? 202 : 200 },
  );
}
