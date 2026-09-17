import {
  hotelbedsProductConfigured,
  hotelbedsProductRequest,
} from "./client";

export type HotelbedsTransferAvailabilityInput = {
  language?: string;
  fromType: string;
  fromCode: string;
  toType: string;
  toCode: string;
  outbound: string;
  inbound?: string;
  adults: number;
  children?: number;
  infants?: number;
};

export type HotelbedsTransferRoute = {
  code?: string;
  from?: { type?: string; code?: string };
  to?: { type?: string; code?: string };
};

export function hotelbedsTransfersConfigured() {
  return hotelbedsProductConfigured("transfers");
}

export async function getHotelbedsTransferRoutes(
  destinationCode: string,
  limit = 25,
  offset = 0
) {
  const params = new URLSearchParams({
    fields: "ALL",
    destinationCode: destinationCode.trim().toUpperCase(),
    offset: String(Math.max(0, Math.floor(offset))),
    limit: String(Math.min(100, Math.max(1, Math.floor(limit)))),
  });

  return hotelbedsProductRequest<HotelbedsTransferRoute[] | Record<string, unknown>>(
    "transfers",
    `/transfer-cache-api/1.0/routes?${params.toString()}`
  );
}

export async function searchHotelbedsTransfers(
  input: HotelbedsTransferAvailabilityInput
) {
  const language = input.language || "en";
  const parts = [
    "/transfer-api/1.0/availability",
    encodeURIComponent(language),
    "from",
    encodeURIComponent(input.fromType),
    encodeURIComponent(input.fromCode),
    "to",
    encodeURIComponent(input.toType),
    encodeURIComponent(input.toCode),
    encodeURIComponent(input.outbound),
  ];
  if (input.inbound) parts.push(encodeURIComponent(input.inbound));
  parts.push(
    String(Math.max(1, Math.floor(input.adults))),
    String(Math.max(0, Math.floor(input.children || 0))),
    String(Math.max(0, Math.floor(input.infants || 0)))
  );

  return hotelbedsProductRequest<Record<string, unknown>>(
    "transfers",
    parts.join("/")
  );
}

export async function createHotelbedsTransferBooking(
  bookingRequest: Record<string, unknown>
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "transfers",
    "/transfer-api/1.0/bookings",
    { method: "POST", body: bookingRequest }
  );
}

export async function getHotelbedsTransferBooking(
  reference: string,
  language = "en"
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "transfers",
    `/transfer-api/1.0/bookings/${encodeURIComponent(language)}/reference/${encodeURIComponent(reference)}`
  );
}

export async function cancelHotelbedsTransferBooking(
  reference: string,
  simulate = true,
  language = "en"
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "transfers",
    `/transfer-api/1.0/bookings/${encodeURIComponent(language)}/reference/${encodeURIComponent(reference)}${simulate ? "?simulation=true" : ""}`,
    { method: "DELETE" }
  );
}
