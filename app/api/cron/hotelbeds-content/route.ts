import { NextResponse } from "next/server";
import { syncOneHotelbedsContentPage } from "@/lib/integrations/hotels/hotelbeds-content-sync";
import { authorizedCronRequest } from "@/lib/auth/cron-request";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  if (!(await authorizedCronRequest(request))) {
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
