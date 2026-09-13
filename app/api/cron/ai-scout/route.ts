import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import {
  acquireScoutLease,
  hasActiveScoutRun,
  releaseScoutLease,
} from "@/lib/ai-scout-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  1: 0,
  3: 1,
  5: 2,
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

  if (scheduledSlot !== undefined) {
    const weekIndex = Math.floor(daysSinceEpoch / 7);
    const rotationIndex = ((weekIndex * 3 + scheduledSlot) % ROTATION.length + ROTATION.length) % ROTATION.length;
    return ROTATION[rotationIndex];
  }

  const fallbackIndex = ((daysSinceEpoch % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[fallbackIndex];
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const activeRun = await hasActiveScoutRun();
  if (activeRun) {
    return NextResponse.json(
      {
        accepted: false,
        skipped: true,
        run_id: activeRun.id,
        message: `AI Scout is already running for ${activeRun.location} / ${activeRun.category}.`,
      },
      { status: 202 }
    );
  }

  const leaseOwner = randomUUID();
  const leaseAcquired = await acquireScoutLease(leaseOwner);
  if (!leaseAcquired) {
    return NextResponse.json(
      { accepted: false, skipped: true, message: "Another AI Scout run acquired the lease first." },
      { status: 202 }
    );
  }

  const { location, category } = getTodayRotation();
  const formData = new FormData();
  formData.append("location", location);
  formData.append("category", category);

  void runAIScout(formData)
    .catch((error: unknown) => {
      console.error("AI SCOUT CRON BACKGROUND ERROR:", error);
    })
    .finally(async () => {
      try {
        await releaseScoutLease(leaseOwner);
      } catch (error) {
        console.error("AI SCOUT CRON LEASE RELEASE ERROR:", error);
      }
    });

  return NextResponse.json(
    {
      accepted: true,
      location,
      category,
      message: "Scheduled AI Scout mission started.",
    },
    { status: 202 }
  );
}
