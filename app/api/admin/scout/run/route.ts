import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  acquireScoutLease,
  hasActiveScoutRun,
  releaseScoutLease,
} from "@/lib/ai-scout-health";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let leaseOwner: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (data.claims.app_metadata?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const activeRun = await hasActiveScoutRun();
    if (activeRun) {
      return NextResponse.json(
        {
          error: `An AI Scout run is already in progress for ${activeRun.location} / ${activeRun.category}. Please wait for it to finish.`,
          run_id: activeRun.id,
        },
        { status: 409 }
      );
    }

    leaseOwner = randomUUID();
    const leaseAcquired = await acquireScoutLease(leaseOwner);

    if (!leaseAcquired) {
      return NextResponse.json(
        { error: "Another AI Scout run started at the same time. Please try again shortly." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const location = String(body.location || "Nairobi").trim();
    const category = String(body.category || "Events & Experiences").trim();
    const formData = new FormData();
    formData.append("location", location);
    formData.append("category", category);

    await runAIScout(formData);

    // Verify the persisted result before reporting success. A successful HTTP
    // response must never hide a failed database read or a zero-discovery run.
    const { data: latestRun, error: latestRunError } = await supabaseAdmin
      .from("ai_scout_runs")
      .select("id,status,events_found,created_at")
      .eq("location", location)
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRunError) {
      console.error("SCOUT RESULT CHECK ERROR:", latestRunError);
      return NextResponse.json(
        {
          success: false,
          error: "AI Scout ran, but its result could not be verified. Check the Scout run log before retrying.",
        },
        { status: 502 }
      );
    }

    if (!latestRun) {
      return NextResponse.json(
        {
          success: false,
          error: "AI Scout ran, but no persisted run result was found.",
        },
        { status: 502 }
      );
    }

    if (latestRun.status !== "completed") {
      return NextResponse.json(
        {
          success: false,
          run_id: latestRun.id,
          error: `AI Scout did not complete successfully (status: ${latestRun.status}).`,
        },
        { status: 502 }
      );
    }

    if (Number(latestRun.events_found || 0) === 0) {
      await supabaseAdmin
        .from("ai_scout_runs")
        .update({ status: "failed" })
        .eq("id", latestRun.id);

      return NextResponse.json(
        {
          success: false,
          run_id: latestRun.id,
          error: "AI Scout returned no discoveries. The run was marked failed instead of reporting a false success.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      run_id: latestRun.id,
      events_found: Number(latestRun.events_found || 0),
      message: "AI Scout completed successfully.",
    });
  } catch (error: unknown) {
    console.error("SCOUT RUN ERROR:", error);

    const message = error instanceof Error ? error.message : "Scout failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  } finally {
    if (leaseOwner) {
      await releaseScoutLease(leaseOwner);
    }
  }
}
