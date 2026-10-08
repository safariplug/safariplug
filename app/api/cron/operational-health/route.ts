import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadProductionOpsSnapshot } from "@/lib/ops/production-ops";
import { authorizedCronRequest } from "@/lib/auth/cron-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ageMinutes(value: string | null) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Unknown structured error");
  }
  return String(error || "Unknown error");
}

export async function GET(request: NextRequest) {
  if (!(await authorizedCronRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [ops, aiScout, supplierScout, proofs, launchChecks, followups] = await Promise.all([
      loadProductionOpsSnapshot().catch((error) => {
        throw new Error("production_ops: " + errorMessage(error));
      }),
      supabaseAdmin
        .from("ai_scout_runs")
        .select("id,status,queued_at,started_at,completed_at,last_error")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("supplier_scout_jobs")
        .select("id,status,queued_at,claimed_at,completed_at,last_error")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("production_payment_proofs")
        .select("product,verified_at")
        .order("verified_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("production_launch_checks")
        .select("check_key,status,verified_at")
        .order("check_key"),
      supabaseAdmin
        .from("supplier_followup_prep_runs")
        .select("status,started_at,completed_at,checked_count,prepared_count,skipped_count,error_message")
        .order("started_at", { ascending: false })
        .limit(1),
    ]);

    const dbErrors = [
      aiScout.error,
      supplierScout.error,
      proofs.error,
      launchChecks.error,
      followups.error,
    ].filter(Boolean);
    if (dbErrors.length) throw new Error("database: " + errorMessage(dbErrors[0]));

    const staleThresholdMinutes = 30;
    const aiRows = aiScout.data || [];
    const supplierRows = supplierScout.data || [];

    const staleAi = aiRows.filter((row: any) => {
      if (!["queued", "running"].includes(String(row.status))) return false;
      const age = ageMinutes(row.started_at || row.queued_at);
      return age !== null && age >= staleThresholdMinutes;
    });

    const staleSupplier = supplierRows.filter((row: any) => {
      if (!["queued", "running"].includes(String(row.status))) return false;
      const age = ageMinutes(row.claimed_at || row.queued_at);
      return age !== null && age >= staleThresholdMinutes;
    });

    const proofCounts = { hotel: 0, activity: 0, transfer: 0, service: 0 };
    for (const row of proofs.data || []) {
      const product = String(row.product || "");
      if (product in proofCounts) (proofCounts as Record<string, number>)[product] += 1;
    }

    const checks = Object.fromEntries(
      (launchChecks.data || []).map((row: any) => [String(row.check_key), String(row.status)])
    );

    const supplierAutomationEnabled = process.env.SUPPLIER_SCOUT_AUTOMATION_ENABLED === "true";
    const issues: string[] = [];

    if (!supplierAutomationEnabled) issues.push("supplier_automation_paused");
    if (staleAi.length) issues.push("stale_ai_scout_jobs");
    if (staleSupplier.length) issues.push("stale_supplier_scout_jobs");
    if (ops.summary.critical > 0) issues.push("critical_production_alerts");

    return NextResponse.json({
      ok: issues.length === 0,
      generated_at: new Date().toISOString(),
      config: {
        supplier_scout_automation_enabled: supplierAutomationEnabled,
        cron_secret_configured: Boolean(process.env.CRON_SECRET),
      },
      agents: {
        ai_scout: {
          active: aiRows.filter((row: any) => ["queued", "running"].includes(String(row.status))).length,
          failed_recent: aiRows.filter((row: any) => row.status === "failed").length,
          stale: staleAi.length,
          completed_recent: aiRows.filter((row: any) => row.status === "completed").length,
        },
        supplier_scout: {
          active: supplierRows.filter((row: any) => ["queued", "running"].includes(String(row.status))).length,
          failed_recent: supplierRows.filter((row: any) => row.status === "failed").length,
          stale: staleSupplier.length,
          completed_recent: supplierRows.filter((row: any) => row.status === "completed").length,
        },
        supplier_followup_latest: (followups.data || [])[0] || null,
      },
      production: {
        summary: ops.summary,
        payment_proofs: proofCounts,
        launch_checks: checks,
      },
      issues,
    }, { status: issues.length ? 503 : 200 });
  } catch (error) {
    console.error("OPERATIONAL HEALTH PROBE ERROR", error);
    return NextResponse.json({
      ok: false,
      error: errorMessage(error),
    }, { status: 500 });
  }
}
