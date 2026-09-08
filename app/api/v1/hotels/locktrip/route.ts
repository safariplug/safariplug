import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";

export const dynamic = "force-dynamic";
const RETAIL_MARKUP_PERCENT = 10;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");

function errorResponse(status: number, message: string) { return NextResponse.json({ error: "locktrip_error", message }, { status }); }
function retailAmount(net: number) { return Math.round(net * (1 + RETAIL_MARKUP_PERCENT / 100) * 100) / 100; }
async function requireUser() { const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); return user; }
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
async function attachConfirmedHotelToTrip(params: { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string; tripId: string; ledgerId: string; hotelName: string; checkIn: string | null; checkOut: string | null; providerReference: string | null; cityId?: string | null }) {
  const { supabase, userId, tripId, ledgerId, hotelName, checkIn, checkOut, providerReference, cityId } = params;
  const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).eq("traveler_id", userId).maybeSingle();
  if (!trip) throw new Error("Trip not found.");
  const marker = `SafariPlug hotel ledger: ${ledgerId}`;
  const { data: existing } = await supabase.from("trip_items").select("id,trip_id,item_kind,position,start_at,end_at,title,notes,city_id").eq("trip_id", tripId).eq("item_kind", "hotel").ilike("notes", `%${ledgerId}%`).maybeSingle();
  if (existing) return existing;
  const { count } = await supabase.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const notes = [marker, providerReference ? `LockTrip reference: ${providerReference}` : null].filter(Boolean).join("\n");
  const { data, error } = await supabase.from("trip_items").insert({ trip_id: tripId, item_kind: "hotel", booking_id: null, position: count ?? 0, start_at: checkIn, end_at: checkOut, title: hotelName, city_id: cityId || null, notes }).select("id,trip_id,item_kind,position,start_at,end_at,title,notes,city_id").single();
  if (error) throw new Error(`Hotel booking confirmed, but itinerary attachment failed: ${error.message}`);
  return data;
}
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return errorResponse(401, "Authentication required.");
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse(400, "Invalid JSON body."); }
  const action = String(body.action || ""); const adapter = new LockTripHotelAdapter();
  try {
    if (action === "rooms") {
      const hotelId = String(body.hotelId || ""), searchKey = String(body.searchKey || ""), regionId = String(body.regionId || ""), checkIn = String(body.checkIn || ""), checkOut = String(body.checkOut || ""), rooms = Array.isArray(body.rooms) ? body.rooms : [];
      if (!hotelId || !searchKey || !regionId || !checkIn || !checkOut || rooms.length === 0) return errorResponse(400, "hotelId, searchKey, regionId, checkIn, checkOut and rooms are required.");
      const data = await adapter.getRooms({ hotelId, searchKey, regionId, checkIn, checkOut, rooms: rooms as Array<{ adults: number; childrenAges?: number[] }>, currency: typeof body.currency === "string" ? body.currency : undefined });
      return NextResponse.json({ provider: "locktrip", ...data });
    }
    if (action === "prepare") {
      const email = user.email || String(body.email || ""); if (!email) return errorResponse(400, "A customer email is required.");
      const quoteId = String(body.quoteId || ""), searchKey = String(body.searchKey || ""); if (!quoteId || !searchKey) return errorResponse(400, "quoteId and searchKey are required.");
      const token = await getLockTripToken(adapter, email);
      const booking = await adapter.prepareBooking(token, { quoteId, searchKey, rooms: body.rooms, contactPerson: body.contactPerson, specialRequests: typeof body.specialRequests === "string" ? body.specialRequests : undefined });
      const currency = String(body.currency || booking.currency || "USD").toUpperCase(), supplierNetAmount = Number(booking.price); if (!Number.isFinite(supplierNetAmount) || supplierNetAmount < 0) return errorResponse(502, "LockTrip returned an invalid booking price.");
      const retail = retailAmount(supplierNetAmount), supabase = await createSupabaseServerClient(), tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : null;
      const { data: ledger, error: ledgerError } = await supabase.from("hotel_booking_pricing_ledger").insert({ customer_user_id: user.id, provider: "locktrip", quote_id: quoteId, prepared_booking_id: booking.preparedBookingId, currency, supplier_net_amount: supplierNetAmount, retail_amount: retail, markup_percent: RETAIL_MARKUP_PERCENT, payment_status: "pending", booking_status: "payment_pending", supplier_settlement_status: "pending", metadata: { searchKey, hotelId: body.hotelId ?? null, checkIn: body.checkIn ?? null, checkOut: body.checkOut ?? null, tripId } }).select("id, supplier_net_amount, retail_amount, currency, markup_percent, payment_status, booking_status").single();
      if (ledgerError || !ledger) throw new Error("Unable to create hotel pricing ledger entry.");
      const method = String(body.method || "revolut").toLowerCase();
      const successUrl = `${SITE_URL}/hotels/booking-result?bookingId=${encodeURIComponent(booking.preparedBookingId)}${tripId ? `&tripId=${encodeURIComponent(tripId)}` : ""}`;
      const checkout = method === "stripe" ? await adapter.getPaymentUrl(token, { bookingId: booking.preparedBookingId, currency, backUrl: `${SITE_URL}/hotels`, successUrl: typeof body.successUrl === "string" ? body.successUrl : successUrl }) : await adapter.createCheckout(token, { bookingId: booking.preparedBookingId, currency, backUrl: typeof body.backUrl === "string" ? body.backUrl : `${SITE_URL}/hotels`, successUrl: typeof body.successUrl === "string" ? body.successUrl : successUrl });
      const paymentReference = typeof checkout.sessionId === "string" ? checkout.sessionId : typeof checkout.checkoutToken === "string" ? checkout.checkoutToken : null;
      if (paymentReference) await supabase.from("hotel_booking_pricing_ledger").update({ payment_provider: `locktrip_${method}`, payment_reference: paymentReference }).eq("id", ledger.id);
      return NextResponse.json({ provider: "locktrip", booking, pricing: { supplierNetAmount, retailAmount: retail, markupPercent: RETAIL_MARKUP_PERCENT, currency }, ledger: { ...ledger, payment_provider: `locktrip_${method}`, payment_reference: paymentReference }, checkout: { method, ...checkout } });
    }
    if (action === "status") {
      const preparedBookingId = String(body.preparedBookingId || ""); if (!preparedBookingId) return errorResponse(400, "preparedBookingId is required.");
      const supabase = await createSupabaseServerClient(); const { data: ledger, error: ledgerError } = await supabase.from("hotel_booking_pricing_ledger").select("*").eq("customer_user_id", user.id).eq("prepared_booking_id", preparedBookingId).maybeSingle();
      if (ledgerError) throw new Error(ledgerError.message); if (!ledger) return errorResponse(404, "Hotel booking not found.");
      const email = user.email || ""; if (!email) return errorResponse(400, "A customer email is required.");
      const token = await getLockTripToken(adapter, email); const details = await adapter.getBookingDetails(token, preparedBookingId); const providerStatus = String(details.status || "").toUpperCase(), paymentStatus = String(details.paymentStatus || "").toUpperCase();
      const confirmed = providerStatus === "DONE" && paymentStatus === "PAID", cancelled = providerStatus === "CANCELLED", failed = cancelled || providerStatus === "FAILED";
      const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
      const updates: Record<string, unknown> = { metadata: { ...metadata, lastProviderStatus: details } };
      if (confirmed) { updates.payment_status = "paid"; updates.booking_status = "confirmed"; updates.supplier_settlement_status = "pending"; updates.provider_booking_reference = details.bookingReferenceId || null; updates.paid_at = details.confirmedAt || new Date().toISOString(); updates.confirmed_at = details.confirmedAt || new Date().toISOString(); }
      else if (failed) { updates.payment_status = cancelled ? "cancelled" : "failed"; updates.booking_status = cancelled ? "cancelled" : "failed"; }
      const { data: updatedLedger, error: updateError } = await supabase.from("hotel_booking_pricing_ledger").update(updates).eq("id", ledger.id).eq("customer_user_id", user.id).select("*").single(); if (updateError) throw new Error(updateError.message);
      const storedTripId = typeof metadata.tripId === "string" ? metadata.tripId : null, tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : storedTripId;
      let itineraryItem = null;
      if (confirmed && tripId) itineraryItem = await attachConfirmedHotelToTrip({ supabase, userId: user.id, tripId, ledgerId: ledger.id, hotelName: details.hotel?.name || "Hotel stay", checkIn: details.checkIn || null, checkOut: details.checkOut || null, providerReference: details.bookingReferenceId || null });
      return NextResponse.json({ provider: "locktrip", status: confirmed ? "confirmed" : failed ? String(updates.booking_status) : "payment_pending", providerBooking: details, ledger: updatedLedger, itineraryItem });
    }
    return errorResponse(400, "Unsupported LockTrip action.");
  } catch (error) { return errorResponse(502, error instanceof Error ? error.message : "LockTrip request failed."); }
}
