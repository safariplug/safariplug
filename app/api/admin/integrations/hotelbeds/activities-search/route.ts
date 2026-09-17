import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { searchHotelbedsActivities } from "@/lib/integrations/hotelbeds/activities";
import { hotelbedsProductConfig } from "@/lib/integrations/hotelbeds/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function resultCount(payload: Record<string, unknown>) {
  const candidates = [
    payload.activities,
    (payload.activities as { activities?: unknown } | undefined)?.activities,
    payload.results,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      destinationCode?: string;
      from?: string;
      to?: string;
      ages?: number[];
      text?: string;
    };

    const destinationCode = String(body.destinationCode || "").trim();
    const from = String(body.from || "").trim();
    const to = String(body.to || "").trim();
    const ages = Array.isArray(body.ages)
      ? body.ages.map(Number).filter((age) => Number.isFinite(age) && age >= 0 && age <= 120)
      : [];

    if (!destinationCode || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "Destination code and valid from/to dates are required." }, { status: 400 });
    }
    if (!ages.length) {
      return NextResponse.json({ error: "At least one passenger age is required." }, { status: 400 });
    }

    const config = hotelbedsProductConfig("activities");
    const started = Date.now();
    const supplier = await searchHotelbedsActivities({
      destinationCode,
      from,
      to,
      paxes: ages.map((age) => ({ age })),
      ...(body.text?.trim() ? { text: body.text.trim() } : {}),
    });

    return NextResponse.json({
      ok: true,
      product: "activities",
      environment: config.environment,
      supplierRequestCount: 1,
      bookingCreated: false,
      latencyMs: Date.now() - started,
      resultCount: resultCount(supplier),
      responseKeys: Object.keys(supplier).slice(0, 20),
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Hotelbeds Activities search probe failed.",
      supplierRequestCount: status === 502 ? 1 : 0,
      bookingCreated: false,
    }, { status });
  }
}
