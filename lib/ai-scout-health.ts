import { supabaseAdmin } from "@/lib/supabase-admin";

const STALE_AFTER_MINUTES = 10;

export async function recoverStaleScoutRuns() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("ai_scout_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      notes: "AI Scout run marked failed automatically because it exceeded the 10-minute stale-run threshold.",
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    console.error("STALE SCOUT RECOVERY ERROR:", error);
    return 0;
  }

  if (data?.length) {
    console.warn(`Recovered ${data.length} stale AI Scout run(s).`);
  }

  return data?.length ?? 0;
}

export async function hasActiveScoutRun() {
  await recoverStaleScoutRuns();

  const { data, error } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id, location, category, started_at")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("ACTIVE SCOUT CHECK ERROR:", error);
    throw new Error("Could not check AI Scout status");
  }

  return data;
}
