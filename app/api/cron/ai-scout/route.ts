import { NextRequest, NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";

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
  const day = new Date().getUTCDay();
  return ROTATION[day] ?? ROTATION[0];
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
    return NextResponse.json({ success: true, location, category });
  } catch (error) {
    console.error("AI SCOUT CRON ERROR:", error);
    return NextResponse.json(
      { success: false, location, category, error: error instanceof Error ? error.message : "AI Scout failed" },
      { status: 500 },
    );
  }
}
