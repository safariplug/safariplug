import { NextResponse } from "next/server";
import { syncOneHotelbedsContentPage } from "@/lib/integrations/hotels/hotelbeds-content-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncOneHotelbedsContentPage();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Hotelbeds content sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hotelbeds content sync failed." },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
