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

const SCHEDULED_DAY_SLOTS: Record<number, number> = {
  1: 0, // Monday
  3: 1, // Wednesday
  5: 2, // Friday
};

function getNairobiCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return new Date(Date.UTC(year, month - 1, day));
}

function getTodayRotation() {
  const nairobiDate = getNairobiCalendarDate();
  const epochMonday = Date.UTC(2026, 0, 5);
  const daysSinceEpoch = Math.floor((nairobiDate.getTime() - epochMonday) / 86_400_000);
  const weekday = nairobiDate.getUTCDay();
  const scheduledSlot = SCHEDULED_DAY_SLOTS[weekday];

  // The production scheduler runs Monday, Wednesday, and Friday. Advancing
  // three positions per week means all seven location/category targets are
  // covered over successive runs instead of permanently skipping entries.
  if (scheduledSlot !== undefined) {
    const weekIndex = Math.floor(daysSinceEpoch / 7);
    const rotationIndex = ((weekIndex * 3 + scheduledSlot) % ROTATION.length + ROTATION.length) % ROTATION.length;
    return ROTATION[rotationIndex];
  }

  // Manual/diagnostic calls made on other days still receive a deterministic
  // target without changing the scheduled three-times-weekly sequence.
  const fallbackIndex = ((daysSinceEpoch % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[fallbackIndex];
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
