import { NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hasActiveScoutRun } from "@/lib/ai-scout-health";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
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

    const body = await request.json();
    const formData = new FormData();
    formData.append("location", body.location || "Nairobi");
    formData.append("category", body.category || "Events & Experiences");

    await runAIScout(formData);

    return NextResponse.json({
      success: true,
      message: "AI Scout completed successfully.",
    });
  } catch (error: unknown) {
    console.error("SCOUT RUN ERROR:", error);

    const message = error instanceof Error ? error.message : "Scout failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
