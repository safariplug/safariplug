import { NextResponse } from "next/server";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";

export const dynamic = "force-dynamic";

function fail(status: number, message: string) {
  return NextResponse.json({ error: "locktrip_error", message }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON body.");
  }

  const action = String(body.action || "").trim();
  const adapter = new LockTripHotelAdapter();

  try {
    if (action === "rooms") {
      const hotelId = String(body.hotelId || "");
      const searchKey = String(body.searchKey || "");
      const regionId = String(body.regionId || "");
      const checkIn = String(body.checkIn || "");
      const checkOut = String(body.checkOut || "");
      const rooms = Array.isArray(body.rooms) ? body.rooms : [];
      if (!hotelId || !searchKey || !regionId || !checkIn || !checkOut || rooms.length === 0) {
        return fail(400, "hotelId, searchKey, regionId, checkIn, checkOut and rooms are required.");
      }
      const data = await adapter.getRooms({
        hotelId,
        searchKey,
        regionId,
        checkIn,
        checkOut,
        rooms: rooms as Array<{ adults: number; childrenAges?: number[] }>,
        currency: typeof body.currency === "string" ? body.currency : "KES",
      });
      return NextResponse.json({ provider: "locktrip", action, data });
    }

    if (action === "details") {
      const hotelId = String(body.hotelId || "");
      if (!hotelId) return fail(400, "hotelId is required.");
      const data = await adapter.getHotelDetails(
        hotelId,
        body.includeImages !== false,
        Number(body.imageLimit || 30)
      );
      return NextResponse.json({ provider: "locktrip", action, data });
    }

    if (action === "cancellation_policy") {
      const hotelId = String(body.hotelId || "");
      const searchKey = String(body.searchKey || "");
      const quoteIds = Array.isArray(body.quoteIds) ? body.quoteIds.map(String) : [];
      if (!hotelId || !searchKey || !quoteIds.length) {
        return fail(400, "hotelId, searchKey and quoteIds are required.");
      }
      const data = await adapter.checkCancellationPolicy(searchKey, hotelId, quoteIds);
      return NextResponse.json({ provider: "locktrip", action, data });
    }

    return fail(400, "Unsupported public LockTrip action.");
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "LockTrip request failed.");
  }
}
