import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROTATION = [
  { location: "Nairobi", category: "Music & Nightlife" },
  { location: "Mombasa", category: "Food & Drink" },
  { location: "Kampala", category: "Music & Nightlife" },
  { location: "Dar es Salaam", category: "Music & Nightlife" },
  { location: "Zanzibar", category: "Food & Drink" },
  { location: "Kigali", category: "Culture & Arts" },
  { location: "Accra", category: "Music & Nightlife" },
  { location: "Lagos", category: "Music & Nightlife" },
  { location: "Cape Town", category: "Food & Drink" },
  { location: "Johannesburg", category: "Music & Nightlife" },
  { location: "Addis Ababa", category: "Culture & Arts" },
  { location: "Marrakech", category: "Culture & Arts" },
  { location: "Cairo", category: "Culture & Arts" },
  { location: "Diani", category: "Adventure" },
  { location: "Nairobi", category: "Festivals" },
] as const;

const SCHEDULED_DAY_SLOTS: Record<number, number> = { 1: 0, 3: 1, 5: 2 };

function getNairobiCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function getTodayRotation() {
  const nairobiDate = getNairobiCalendarDate();
  const epochMonday = Date.UTC(2026, 0, 5);
  const daysSinceEpoch = Math.floor((nairobiDate.getTime() - epochMonday) / 86_400_000);
  const scheduledSlot = SCHEDULED_DAY_SLOTS[nairobiDate.getUTCDay()];

  if (scheduledSlot !== undefined) {
    const weekIndex = Math.floor(daysSinceEpoch / 7);
    const rotationIndex = ((weekIndex * 3 + scheduledSlot) % ROTATION.length + ROTATION.length) % ROTATION.length;
    return ROTATION[rotationIndex];
  }

  return ROTATION[((daysSinceEpoch % ROTATION.length) + ROTATION.length) % ROTATION.length];
}

async function findActive(location: string, category: string) {
  const { data } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id,location,category,status,queued_at")
    .in("status", ["queued", "running"])
    .eq("category", category)
    .ilike("location", location)
    .not("queued_at", "is", null)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { location, category } = getTodayRotation();
  const existing = await findActive(location, category);
  if (existing) {
    return NextResponse.json({
      accepted: true,
      existing: true,
      run_id: existing.id,
      location: existing.location,
      category: existing.category,
      status: existing.status,
      message: "Scheduled Scout mission already active; duplicate enqueue skipped.",
    });
  }

  const { data: job, error } = await supabaseAdmin
    .from("ai_scout_runs")
    .insert({
      location,
      category,
      status: "queued",
      events_found: 0,
      queued_at: new Date().toISOString(),
      started_at: null,
      claimed_at: null,
      completed_at: null,
      notes: "Queued by the autonomous Monday/Wednesday/Friday AI Scout schedule.",
    })
    .select("id,location,category,status,queued_at")
    .single();

  if (error || !job) {
    if (error?.code === "23505") {
      const duplicate = await findActive(location, category);
      if (duplicate) {
        return NextResponse.json({
          accepted: true,
          existing: true,
          run_id: duplicate.id,
          location: duplicate.location,
          category: duplicate.category,
          status: duplicate.status,
          message: "Scheduled Scout mission already active; duplicate enqueue skipped.",
        });
      }
    }
    console.error("AI SCOUT SCHEDULE QUEUE ERROR:", error);
    return NextResponse.json({ success: false, error: "Could not queue scheduled AI Scout mission." }, { status: 500 });
  }

  return NextResponse.json(
    {
      accepted: true,
      queued: true,
      existing: false,
      run_id: job.id,
      location: job.location,
      category: job.category,
      message: "Scheduled AI Scout mission queued.",
    },
    { status: 202 },
  );
}
