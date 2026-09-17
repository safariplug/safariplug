import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { hotelbedsProductConfig } from "@/lib/integrations/hotelbeds/client";
import { searchHotelbedsTransfers } from "@/lib/integrations/hotelbeds/transfers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function resultCount(payload: Record<string, unknown>) {
  const candidates = [
    payload.services,
    (payload.services as { services?: unknown } | undefined)?.services,
    payload.transfers,
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
      fromType?: string;
      fromCode?: string;
      toType?: string;
      toCode?: string;
      outbound?: string;
      inbound?: string;
      adults?: number;
      children?: number;
      infants?: number;
    };

    const fromType = String(body.fromType || "").trim().toUpperCase();
    const fromCode = String(body.fromCode || "").trim();
    const toType = String(body.toType || "").trim().toUpperCase();
    const toCode = String(body.toCode || "").trim();
    const outbound = String(body.outbound || "").trim();
    const inbound = String(body.inbound || "").trim();
    const adults = Math.max(1, Math.floor(Number(body.adults || 1)));
    const children = Math.max(0, Math.floor(Number(body.children || 0)));
    const infants = Math.max(0, Math.floor(Number(body.infants || 0)));

    if (!fromType || !fromCode || !toType || !toCode || !outbound) {
      return NextResponse.json({ error: "Pickup/drop-off type, code, and outbound date/time are required." }, { status: 400 });
    }

    const config = hotelbedsProductConfig("transfers");
    const started = Date.now();
    const supplier = await searchHotelbedsTransfers({
      fromType,
      fromCode,
      toType,
      toCode,
      outbound,
      ...(inbound ? { inbound } : {}),
      adults,
      children,
      infants,
    });

    return NextResponse.json({
      ok: true,
      product: "transfers",
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
      error: error instanceof Error ? error.message : "Hotelbeds Transfers availability probe failed.",
      supplierRequestCount: status === 502 ? 1 : 0,
      bookingCreated: false,
    }, { status });
  }
}
