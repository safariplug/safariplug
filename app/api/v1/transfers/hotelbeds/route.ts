import { NextResponse } from "next/server";
import {
  hotelbedsTransfersConfigured,
  searchHotelbedsTransfers,
} from "@/lib/integrations/hotelbeds/transfers";
import { extractHotelbedsTransferSelections } from "@/lib/integrations/hotelbeds/transfer-checkout";

export const dynamic = "force-dynamic";

const LOCATION_TYPES = new Set(["IATA", "ATLAS", "GPS", "PORT", "STATION"]);

function fail(status: number, message: string) {
  return NextResponse.json(
    { error: "hotelbeds_transfers_error", message },
    { status }
  );
}

function validDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
}

export async function GET() {
  return NextResponse.json({
    provider: "hotelbeds",
    product: "transfers",
    configured: hotelbedsTransfersConfigured(),
    availability_exposed: true,
    checkout_selection_tokens: true,
    supplier_confirmation_requires_payment: true,
  });
}

export async function POST(request: Request) {
  if (!hotelbedsTransfersConfigured()) {
    return fail(503, "Hotelbeds Transfers credentials are not configured.");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON body.");
  }

  const action = String(body.action || "availability").trim().toLowerCase();
  if (action !== "availability") {
    return fail(400, "Only transfer availability is exposed on this endpoint.");
  }

  const fromType = String(body.fromType || "").toUpperCase();
  const toType = String(body.toType || "").toUpperCase();
  const fromCode = String(body.fromCode || "").trim();
  const toCode = String(body.toCode || "").trim();
  const outbound = String(body.outbound || "");
  const inbound =
    typeof body.inbound === "string" && body.inbound ? body.inbound : undefined;
  const adults = Math.floor(Number(body.adults || 0));
  const children = Math.max(0, Math.floor(Number(body.children || 0)));
  const infants = Math.max(0, Math.floor(Number(body.infants || 0)));

  if (!LOCATION_TYPES.has(fromType) || !LOCATION_TYPES.has(toType)) {
    return fail(400, "Unsupported transfer location type.");
  }
  if (!fromCode || !toCode) {
    return fail(400, "fromCode and toCode are required.");
  }
  if (!validDateTime(outbound) || (inbound && !validDateTime(inbound))) {
    return fail(400, "Valid outbound/inbound date-times are required.");
  }
  if (!Number.isFinite(adults) || adults < 1 || adults > 99) {
    return fail(400, "At least one adult passenger is required.");
  }

  try {
    const data = await searchHotelbedsTransfers({
      language: String(body.language || "en").slice(0, 5),
      fromType,
      fromCode,
      toType,
      toCode,
      outbound,
      inbound,
      adults,
      children,
      infants,
    });

    const checkoutSelections = extractHotelbedsTransferSelections(data, {
      fromType,
      fromCode,
      toType,
      toCode,
      outbound,
      inbound,
      adults,
      children,
      infants,
    });

    return NextResponse.json({
      provider: "hotelbeds",
      product: "transfers",
      action,
      data,
      checkoutSelections,
      bookingCreated: false,
    });
  } catch (error) {
    return fail(
      502,
      error instanceof Error ? error.message : "Hotelbeds Transfers request failed."
    );
  }
}
