import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";

export const dynamic = "force-dynamic";
const RETAIL_MARKUP_PERCENT = 10;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: "locktrip_error", message }, { status });
}

function retailAmount(net: number) {
  return Math.round(net * (1 + RETAIL_MARKUP_PERCENT / 100) * 100) / 100;
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
    const result = await fetch(`${process.env.SAFARIPLUG_HOTEL_LOCKTRIP_BASE_URL || "https://locktrip.com/mcp/tools"}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: configuredEmail, password: configuredPassword }), cache: "no-store" });
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
      const hotelId = String(body.hotelId || ""); const searchKey = String(body.searchKey || ""); const regionId = String(body.regionId || "");
      const checkIn = String(body.checkIn || ""); const checkOut = String(body.checkOut || ""); const rooms = Array.isArray(body.rooms) ? body.rooms : [];
      if (!hotelId || !searchKey || !regionId || !checkIn || !checkOut || rooms.length === 0) return errorResponse(400, "hotelId, searchKey, regionId, checkIn, checkOut and rooms are required.");
      const data = await adapter.getRooms({ hotelId, searchKey, regionId, checkIn, checkOut, rooms: rooms as Array<{ adults: number; childrenAges?: number[] }>, currency: typeof body.currency === "string" ? body.currency : undefined });
      return NextResponse.json({ provider: "locktrip", ...data });
    }

    if (action === "prepare") {
      const email = user.email || String(body.email || "");
      if (!email) return errorResponse(400, "A customer email is required.");
      const quoteId = String(body.quoteId || "");
      const searchKey = String(body.searchKey || "");
      if (!quoteId || !searchKey) return errorResponse(400, "quoteId and searchKey are required.");
      const token = await getLockTripToken(adapter, email);
      const booking = await adapter.prepareBooking(token, { quoteId, searchKey, rooms: body.rooms, contactPerson: body.contactPerson, specialRequests: typeof body.specialRequests === "string" ? body.specialRequests : undefined });
      const currency = String(body.currency || booking.currency || "USD").toUpperCase();
      const supplierNetAmount = Number(booking.price);
      if (!Number.isFinite(supplierNetAmount) || supplierNetAmount < 0) return errorResponse(502, "LockTrip returned an invalid booking price.");
      const retail = retailAmount(supplierNetAmount);
      const supabase = await createSupabaseServerClient();
      const { data: ledger, error: ledgerError } = await supabase
        .from("hotel_booking_pricing_ledger")
        .insert({
          customer_user_id: user.id,
          provider: "locktrip",
          quote_id: quoteId,
          prepared_booking_id: booking.preparedBookingId,
          currency,
          supplier_net_amount: supplierNetAmount,
          retail_amount: retail,
          markup_percent: RETAIL_MARKUP_PERCENT,
          payment_status: "pending",
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: { searchKey, hotelId: body.hotelId ?? null, checkIn: body.checkIn ?? null, checkOut: body.checkOut ?? null }
        })
        .select("id, supplier_net_amount, retail_amount, currency, markup_percent, payment_status, booking_status")
        .single();
      if (ledgerError || !ledger) throw new Error("Unable to create hotel pricing ledger entry.");

      const method = String(body.method || "revolut").toLowerCase();
      const checkout = method === "stripe"
        ? await adapter.getPaymentUrl(token, { bookingId: booking.preparedBookingId, currency, backUrl: String(body.backUrl || "https://safariplug.com/hotels"), successUrl: typeof body.successUrl === "string" ? body.successUrl : undefined })
        : await adapter.createCheckout(token, { bookingId: booking.preparedBookingId, currency, backUrl: typeof body.backUrl === "string" ? body.backUrl : undefined, successUrl: typeof body.successUrl === "string" ? body.successUrl : undefined });
      const paymentReference = typeof checkout.sessionId === "string" ? checkout.sessionId : typeof checkout.checkoutToken === "string" ? checkout.checkoutToken : null;
      if (paymentReference) {
        await supabase.from("hotel_booking_pricing_ledger").update({ payment_provider: `locktrip_${method}`, payment_reference: paymentReference }).eq("id", ledger.id);
      }
      return NextResponse.json({ provider: "locktrip", booking, pricing: { supplierNetAmount, retailAmount: retail, markupPercent: RETAIL_MARKUP_PERCENT, currency }, ledger: { ...ledger, payment_provider: `locktrip_${method}`, payment_reference: paymentReference }, checkout: { method, ...checkout } });
    }

    return errorResponse(400, "Unsupported LockTrip action.");
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "LockTrip request failed.");
  }
}
