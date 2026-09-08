import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";

export const dynamic = "force-dynamic";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: "locktrip_error", message }, { status });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getLockTripToken(adapter: LockTripHotelAdapter, email: string) {
  const configuredEmail = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_EMAIL?.trim();
  const configuredPassword = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_PASSWORD?.trim();

  if (configuredEmail && configuredPassword) {
    const result = await fetch(`${process.env.SAFARIPLUG_HOTEL_LOCKTRIP_BASE_URL || "https://locktrip.com/mcp/tools"}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: configuredEmail, password: configuredPassword }),
      cache: "no-store",
    });
    if (!result.ok) throw new Error("LockTrip account authentication failed.");
    const data = await result.json() as { token?: string };
    if (!data.token) throw new Error("LockTrip did not return an authentication token.");
    return data.token;
  }

  return adapter.guestLogin(email);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return errorResponse(401, "Authentication required.");

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse(400, "Invalid JSON body."); }

  const action = String(body.action || "");
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
        return errorResponse(400, "hotelId, searchKey, regionId, checkIn, checkOut and rooms are required.");
      }
      const data = await adapter.getRooms({ hotelId, searchKey, regionId, checkIn, checkOut, rooms: rooms as Array<{ adults: number; childrenAges?: number[] }>, currency: typeof body.currency === "string" ? body.currency : undefined });
      return NextResponse.json({ provider: "locktrip", ...data });
    }

    if (action === "prepare") {
      const email = user.email || String(body.email || "");
      if (!email) return errorResponse(400, "A customer email is required.");
      const token = await getLockTripToken(adapter, email);
      const booking = await adapter.prepareBooking(token, {
        quoteId: String(body.quoteId || ""),
        searchKey: String(body.searchKey || ""),
        rooms: body.rooms,
        contactPerson: body.contactPerson,
        specialRequests: typeof body.specialRequests === "string" ? body.specialRequests : undefined,
      });
      return NextResponse.json({ provider: "locktrip", ...booking });
    }

    if (action === "checkout") {
      const email = user.email || String(body.email || "");
      if (!email) return errorResponse(400, "A customer email is required.");
      const token = await getLockTripToken(adapter, email);
      const currency = String(body.currency || "USD").toUpperCase();
      const method = String(body.method || "revolut");
      if (method === "stripe") {
        const checkout = await adapter.getPaymentUrl(token, {
          bookingId: String(body.bookingId || ""),
          currency,
          backUrl: String(body.backUrl || "https://safariplug.com/hotels"),
          successUrl: typeof body.successUrl === "string" ? body.successUrl : undefined,
        });
        return NextResponse.json({ provider: "locktrip", method, ...checkout });
      }
      const checkout = await adapter.createCheckout(token, {
        bookingId: String(body.bookingId || ""),
        currency,
        backUrl: typeof body.backUrl === "string" ? body.backUrl : undefined,
        successUrl: typeof body.successUrl === "string" ? body.successUrl : undefined,
      });
      return NextResponse.json({ provider: "locktrip", method: "revolut", ...checkout });
    }

    return errorResponse(400, "Unsupported LockTrip action.");
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "LockTrip request failed.");
  }
}
