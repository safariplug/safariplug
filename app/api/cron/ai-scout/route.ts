import { NextRequest, NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROTATION = [
  { location: "Nairobi", category: "Music & Nightlife" },
  { location: "Mombasa", category: "Music & Nightlife" },
  { location: "Kampala", category: "Music & Nightlife" },
  { location: "Dar es Salaam", category: "Music & Nightlife" },
  { location: "Nairobi", category: "Food & Drink" },
  { location: "Mombasa", category: "Culture & Arts" },
  { location: "Nairobi", category: "Events & Experiences" },
] as const;

function getTodayRotation() {
  const day = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
    })
      .format(new Date())
      .replace("Sun", "0")
      .replace("Mon", "1")
      .replace("Tue", "2")
      .replace("Wed", "3")
      .replace("Thu", "4")
      .replace("Fri", "5")
      .replace("Sat", "6")
  );
  return ROTATION[Number.isInteger(day) ? day : 0] ?? ROTATION[0];
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { location, category } = getTodayRotation();
  const formData = new FormData();
  formData.append("location", location);
  formData.append("category", category);

  try {
    await runAIScout(formData);

    // Verify the persisted result before reporting success. The cron endpoint
    // must not return 200 merely because the server action returned normally.
    const { data: latestRun, error: latestRunError } = await supabaseAdmin
      .from("ai_scout_runs")
      .select("id,status,events_found,created_at")
      .eq("location", location)
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRunError) {
      console.error("AI SCOUT CRON RESULT CHECK ERROR:", latestRunError);
      return NextResponse.json(
        { success: false, location, category, error: "Scout ran, but its persisted result could not be verified." },
        { status: 502 },
      );
    }

    if (!latestRun) {
      return NextResponse.json(
        { success: false, location, category, error: "Scout ran, but no persisted run result was found." },
        { status: 502 },
      );
    }

    if (latestRun.status !== "completed") {
      return NextResponse.json(
        {
          success: false,
          location,
          category,
          run_id: latestRun.id,
          error: `AI Scout did not complete successfully (status: ${latestRun.status}).`,
        },
        { status: 502 },
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
          location,
          category,
          run_id: latestRun.id,
          error: "AI Scout completed without discoveries; the run was marked failed.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      location,
      category,
      run_id: latestRun.id,
      events_found: Number(latestRun.events_found || 0),
      message: "AI Scout completed successfully.",
    });
  } catch (error) {
    console.error("AI SCOUT CRON ERROR:", error);
    return NextResponse.json(
      { success: false, location, category, error: error instanceof Error ? error.message : "AI Scout failed" },
      { status: 500 },
    );
  }
}
