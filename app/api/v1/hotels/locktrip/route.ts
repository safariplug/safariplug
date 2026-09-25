import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import { publicHotelCheckoutLedger } from "@/lib/integrations/hotels/hotel-public-ledger";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { hotelPaymentSafeToRetry, normalizeHotelCheckoutIntentKey, publicHotelCheckoutIntentStatus } from "@/lib/integrations/hotels/hotel-payment-safety";
import { emitConfirmedHotelBooking, emitHotelBookingStart } from "@/lib/growth/hotel-events";

export const dynamic = "force-dynamic";
const RETAIL_MARKUP_PERCENT = 10;
const DEFAULT_CUSTOMER_CURRENCY = "KES";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
const LOCKTRIP_BASE_URL = (process.env.SAFARIPLUG_HOTEL_LOCKTRIP_BASE_URL || "https://locktrip.com/mcp/tools").replace(/\/$/, "");
function errorResponse(status: number, message: string) { return NextResponse.json({ error: "locktrip_error", message }, { status }); }
function retailAmount(net: number) { return Math.round(net * (1 + RETAIL_MARKUP_PERCENT / 100) * 100) / 100; }
async function requireUser() { const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); return user; }
function getConfiguredCredentials() { const email = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_EMAIL?.trim(); const password = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_PASSWORD?.trim(); return email && password ? { email, password } : null; }
async function getRegisteredLockTripToken() { const credentials = getConfiguredCredentials(); if (!credentials) throw new Error("SafariPlug hotel booking is awaiting its registered LockTrip account credentials."); const result = await fetch(`${LOCKTRIP_BASE_URL}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials), cache: "no-store" }); if (!result.ok) throw new Error("LockTrip account authentication failed."); const data = await result.json() as { token?: string }; if (!data.token) throw new Error("LockTrip did not return an authentication token."); return data.token; }
async function getLockTripBookingToken(adapter: LockTripHotelAdapter, email: string) { const credentials = getConfiguredCredentials(); if (credentials) return getRegisteredLockTripToken(); return adapter.guestLogin(email); }
async function attachConfirmedHotelToTrip(params: { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string; tripId: string; ledgerId: string; hotelName: string; checkIn: string | null; checkOut: string | null; providerReference: string | null; cityId?: string | null }) { const { supabase, userId, tripId, ledgerId, hotelName, checkIn, checkOut, providerReference, cityId } = params; const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).eq("traveler_id", userId).maybeSingle(); if (!trip) throw new Error("Trip not found."); const marker = `SafariPlug hotel ledger: ${ledgerId}`; const { data: existing } = await supabase.from("trip_items").select("id,trip_id,item_kind,position,start_at,end_at,title,notes,city_id").eq("trip_id", tripId).eq("item_kind", "hotel").ilike("notes", `%${ledgerId}%`).maybeSingle(); if (existing) return existing; const { count } = await supabase.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId); const notes = [marker, providerReference ? `LockTrip reference: ${providerReference}` : null].filter(Boolean).join("\n"); const { data, error } = await supabase.from("trip_items").insert({ trip_id: tripId, item_kind: "hotel", booking_id: null, position: count ?? 0, start_at: checkIn, end_at: checkOut, title: hotelName, city_id: cityId || null, notes }).select("id,trip_id,item_kind,position,start_at,end_at,title,notes,city_id").single(); if (error) throw new Error(`Hotel booking confirmed, but itinerary attachment failed: ${error.message}`); return data; }
export async function POST(request: Request) {
  const user = await requireUser(); if (!user) return errorResponse(401, "Authentication required.");
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse(400, "Invalid JSON body."); }
  const action = String(body.action || ""); const adapter = new LockTripHotelAdapter();
  try {
    if (action === "rooms") { const hotelId = String(body.hotelId || ""), searchKey = String(body.searchKey || ""), regionId = String(body.regionId || ""), checkIn = String(body.checkIn || ""), checkOut = String(body.checkOut || ""), rooms = Array.isArray(body.rooms) ? body.rooms : []; if (!hotelId || !searchKey || !regionId || !checkIn || !checkOut || rooms.length === 0) return errorResponse(400, "hotelId, searchKey, regionId, checkIn, checkOut and rooms are required."); const data = await adapter.getRooms({ hotelId, searchKey, regionId, checkIn, checkOut, rooms: rooms as Array<{ adults: number; childrenAges?: number[] }>, currency: typeof body.currency === "string" ? body.currency : DEFAULT_CUSTOMER_CURRENCY }); return NextResponse.json({ provider: "locktrip", ...data }); }
    if (action === "prepare") {
      const contactPerson = body.contactPerson && typeof body.contactPerson === "object" && !Array.isArray(body.contactPerson) ? body.contactPerson as Record<string, unknown> : {};
      const email = String(body.email || contactPerson.email || user.email || "").trim();
      if (!email) return errorResponse(400, "A customer email is required.");
      const quoteId = String(body.quoteId || "");
      const searchKey = String(body.searchKey || "");
      if (!quoteId || !searchKey) return errorResponse(400, "quoteId and searchKey are required.");
      const intentKey = normalizeHotelCheckoutIntentKey(body.idempotencyKey);
      const customerCurrency = String(body.currency || DEFAULT_CUSTOMER_CURRENCY).toUpperCase();
      if (customerCurrency !== "KES") return errorResponse(400, "Hotel M-Pesa checkout currently supports KES only.");
      const method = String(body.method || "mpesa").toLowerCase();
      if (method !== "mpesa") return errorResponse(409, "Hotel customer payment must use SafariPlug M-Pesa checkout.");
      const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
      if (!customerPhone) return errorResponse(400, "A customer M-Pesa phone number is required.");
      const hotelName = typeof body.hotelName === "string" && body.hotelName.trim() ? body.hotelName.trim() : null;
      const mpesa = getPaymentAdapter("mpesa");
      if (!mpesa) return errorResponse(503, "M-Pesa is not configured yet.");

      const { data: existingIntent, error: existingIntentError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .select("*")
        .eq("customer_user_id", user.id)
        .eq("provider", "locktrip")
        .eq("intent_key", intentKey)
        .maybeSingle();
      if (existingIntentError) throw new Error(existingIntentError.message);
      if (existingIntent) {
        const publicState = publicHotelCheckoutIntentStatus(
          existingIntent.state,
          existingIntent.prepared_booking_id
        );
        const existingLedger = existingIntent.ledger_id
          ? await supabaseAdmin
              .from("hotel_booking_pricing_ledger")
              .select("*")
              .eq("id", existingIntent.ledger_id)
              .eq("customer_user_id", user.id)
              .maybeSingle()
          : { data: null, error: null };
        if (existingLedger.error) throw new Error(existingLedger.error.message);
        return NextResponse.json({
          provider: "locktrip",
          ...publicState,
          booking: existingIntent.prepared_booking_id
            ? { preparedBookingId: existingIntent.prepared_booking_id }
            : null,
          paymentReused: true,
          ledger: publicHotelCheckoutLedger(existingLedger.data),
          message:
            publicState.reconciliation === "manual_required"
              ? "SafariPlug will not retry the previous supplier/payment attempt automatically because its outcome is indeterminate."
              : undefined,
        });
      }

      const { data: intent, error: intentError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .insert({
          customer_user_id: user.id,
          provider: "locktrip",
          intent_key: intentKey,
          state: "initialized",
        })
        .select("*")
        .single();
      if (intentError || !intent) {
        if (intentError?.code === "23505") {
          const { data: racedIntent } = await supabaseAdmin
            .from("hotel_checkout_intents")
            .select("*")
            .eq("customer_user_id", user.id)
            .eq("provider", "locktrip")
            .eq("intent_key", intentKey)
            .maybeSingle();
          if (racedIntent) {
            return NextResponse.json({
              provider: "locktrip",
              ...publicHotelCheckoutIntentStatus(
                racedIntent.state,
                racedIntent.prepared_booking_id
              ),
              booking: racedIntent.prepared_booking_id
                ? { preparedBookingId: racedIntent.prepared_booking_id }
                : null,
              paymentReused: true,
            });
          }
        }
        throw new Error(intentError?.message || "Unable to initialize LockTrip checkout.");
      }

      await emitHotelBookingStart({
        provider: "locktrip",
        intentId: String(intent.id),
        productId: `hotel-locktrip-${String(body.hotelId || quoteId)}`,
        hotelName,
        checkIn: typeof body.checkIn === "string" ? body.checkIn : null,
        checkOut: typeof body.checkOut === "string" ? body.checkOut : null,
      });

      const supplierStartedAt = new Date().toISOString();
      const { data: supplierClaim, error: supplierClaimError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "supplier_preparing",
          supplier_prepare_started_at: supplierStartedAt,
        })
        .eq("id", intent.id)
        .is("supplier_prepare_started_at", null)
        .select("*")
        .maybeSingle();
      if (supplierClaimError) throw new Error(supplierClaimError.message);
      if (!supplierClaim) {
        return NextResponse.json({
          provider: "locktrip",
          status: "checkout_initializing",
          booking: null,
          paymentReused: true,
        });
      }

      let booking;
      try {
        const token = await getLockTripBookingToken(adapter, email);
        booking = await adapter.prepareBooking(token, {
          quoteId,
          searchKey,
          rooms: body.rooms,
          contactPerson: body.contactPerson,
          specialRequests:
            typeof body.specialRequests === "string"
              ? body.specialRequests
              : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "LockTrip supplier preparation failed.";
        await supabaseAdmin
          .from("hotel_checkout_intents")
          .update({
            state: "supplier_prepare_indeterminate",
            last_error: message,
          })
          .eq("id", intent.id);
        return NextResponse.json({
          provider: "locktrip",
          status: "supplier_prepare_indeterminate",
          reconciliation: "manual_required",
          booking: null,
          message:
            "SafariPlug could not prove whether LockTrip created the prepared booking. It will not submit another supplier preparation automatically because that could create a duplicate reservation.",
        });
      }

      const supplierCurrency = String(booking.currency || "USD").toUpperCase();
      const supplierNetAmount = Number(booking.price);
      if (!Number.isFinite(supplierNetAmount) || supplierNetAmount < 0) {
        await supabaseAdmin
          .from("hotel_checkout_intents")
          .update({
            state: "supplier_prepare_indeterminate",
            prepared_booking_id: booking.preparedBookingId || null,
            last_error: "invalid_supplier_price",
          })
          .eq("id", intent.id);
        return NextResponse.json({
          provider: "locktrip",
          status: "supplier_prepare_indeterminate",
          reconciliation: "manual_required",
          booking: booking.preparedBookingId
            ? { preparedBookingId: booking.preparedBookingId }
            : null,
          message:
            "LockTrip returned a prepared booking with an invalid price. SafariPlug will not prepare another supplier booking automatically.",
        });
      }

      const supplierRetailAmount = retailAmount(supplierNetAmount);
      const converted = await convertCurrency(supplierRetailAmount, supplierCurrency, customerCurrency);
      const supabase = await createSupabaseServerClient();
      const tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : null;

      const { data: ledger, error: ledgerError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .insert({
          customer_user_id: user.id,
          provider: "locktrip",
          checkout_intent_key: intentKey,
          quote_id: quoteId,
          prepared_booking_id: booking.preparedBookingId,
          currency: customerCurrency,
          supplier_currency: supplierCurrency,
          customer_currency: customerCurrency,
          exchange_rate: converted.rate,
          supplier_net_amount: supplierNetAmount,
          retail_amount: supplierRetailAmount,
          customer_retail_amount: converted.amount,
          markup_percent: RETAIL_MARKUP_PERCENT,
          payment_status: "unpaid",
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: {
            searchKey,
            hotelId: body.hotelId ?? null,
            hotelName,
            checkIn: body.checkIn ?? null,
            checkOut: body.checkOut ?? null,
            tripId,
            bookingInternalId: booking.bookingInternalId || booking.preparedBookingId,
          },
        })
        .select("*")
        .single();

      if (ledgerError || !ledger) {
        await supabaseAdmin
          .from("hotel_checkout_intents")
          .update({
            state: "supplier_prepare_indeterminate",
            prepared_booking_id: booking.preparedBookingId || null,
            last_error: ledgerError?.message || "ledger_create_failed",
          })
          .eq("id", intent.id);
        return NextResponse.json({
          provider: "locktrip",
          status: "supplier_prepare_indeterminate",
          reconciliation: "manual_required",
          booking,
          message:
            "LockTrip prepared the booking, but SafariPlug could not persist the payment ledger. No automatic supplier retry will be attempted.",
        });
      }

      await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "supplier_prepared",
          prepared_booking_id: booking.preparedBookingId,
          ledger_id: ledger.id,
          last_error: null,
        })
        .eq("id", intent.id);

      const paymentStartedAt = new Date().toISOString();
      const { data: paymentClaim, error: paymentClaimError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "payment_initializing",
          payment_initiation_started_at: paymentStartedAt,
        })
        .eq("id", intent.id)
        .is("payment_initiation_started_at", null)
        .select("*")
        .maybeSingle();
      if (paymentClaimError) throw new Error(paymentClaimError.message);
      if (!paymentClaim) {
        return NextResponse.json({
          provider: "locktrip",
          status: "checkout_initializing",
          booking,
          paymentReused: true,
          ledger: publicHotelCheckoutLedger(ledger),
        });
      }

      await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({ payment_initiation_started_at: paymentStartedAt })
        .eq("id", ledger.id);

      let payment;
      try {
        payment = await mpesa.createPaymentIntent({
          appointmentId: ledger.id,
          amount: converted.amount,
          currency: customerCurrency,
          customerEmail: email,
          customerPhone,
          returnUrl: `${SITE_URL}/hotels/booking-result?bookingId=${encodeURIComponent(booking.preparedBookingId)}${tripId ? `&tripId=${encodeURIComponent(tripId)}` : ""}`,
          idempotencyKey: `hotel-locktrip:${intentKey}`,
          callbackUrl: `${SITE_URL}/api/v1/hotels/locktrip/mpesa/callback`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "M-Pesa payment initiation failed.";
        if (hotelPaymentSafeToRetry(error)) {
          await Promise.all([
            supabaseAdmin
              .from("hotel_checkout_intents")
              .update({
                state: "supplier_prepared",
                payment_initiation_started_at: null,
                last_error: message,
              })
              .eq("id", intent.id),
            supabaseAdmin
              .from("hotel_booking_pricing_ledger")
              .update({
                payment_status: "unpaid",
                payment_initiation_started_at: null,
              })
              .eq("id", ledger.id),
          ]);
          throw error;
        }

        await supabaseAdmin
          .from("hotel_checkout_intents")
          .update({
            state: "payment_indeterminate",
            last_error: message,
          })
          .eq("id", intent.id);
        return NextResponse.json({
          provider: "locktrip",
          status: "payment_initiation_indeterminate",
          reconciliation: "manual_required",
          booking,
          ledger: publicHotelCheckoutLedger(ledger),
          message:
            "SafariPlug could not prove whether the M-Pesa request was created. It will not submit another payment request automatically because that could cause a duplicate charge.",
        });
      }

      const { data: updatedLedger, error: updateError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          payment_provider: "mpesa",
          payment_reference: payment.providerReference,
          payment_status: "pending",
          metadata: {
            searchKey,
            hotelId: body.hotelId ?? null,
            checkIn: body.checkIn ?? null,
            checkOut: body.checkOut ?? null,
            tripId,
            bookingInternalId: booking.bookingInternalId || booking.preparedBookingId,
            mpesaPaymentId: payment.id,
          },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();
      if (updateError) throw new Error(updateError.message);

      await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "payment_pending",
          last_error: null,
        })
        .eq("id", intent.id);

      return NextResponse.json({
        provider: "locktrip",
        status: "payment_pending",
        booking,
        pricing: {
          supplierNetAmount,
          supplierRetailAmount,
          customerRetailAmount: converted.amount,
          markupPercent: RETAIL_MARKUP_PERCENT,
          supplierCurrency,
          customerCurrency,
          exchangeRate: converted.rate,
        },
        ledger: publicHotelCheckoutLedger(updatedLedger || ledger),
        payment,
      });
    }
    if (action === "payment_status") { const preparedBookingId = String(body.preparedBookingId || ""); if (!preparedBookingId) return errorResponse(400, "preparedBookingId is required."); const supabase = await createSupabaseServerClient(); const { data: ledger, error } = await supabaseAdmin.from("hotel_booking_pricing_ledger").select("*").eq("customer_user_id", user.id).eq("prepared_booking_id", preparedBookingId).maybeSingle(); if (error) throw new Error(error.message); if (!ledger) return errorResponse(404, "Hotel booking not found."); if (ledger.payment_provider !== "mpesa" || !ledger.payment_reference) return errorResponse(409, "This hotel booking does not have an M-Pesa payment reference."); const mpesa = getPaymentAdapter("mpesa"); if (!mpesa) return errorResponse(503, "M-Pesa is not configured yet."); const status = await mpesa.getPaymentStatus(ledger.payment_reference); const updates: Record<string, unknown> = { payment_status: status === "succeeded" ? "paid" : status === "failed" ? "failed" : "pending", metadata: { ...(ledger.metadata || {}), lastMpesaStatus: status } }; if (status === "succeeded") updates.paid_at = new Date().toISOString(); const { data: updatedLedger, error: updateError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update(updates).eq("id", ledger.id).select("*").single(); if (updateError) throw new Error(updateError.message); return NextResponse.json({ provider: "mpesa", status, ledger: publicHotelCheckoutLedger(updatedLedger) }); }
    if (action === "status") {
      const preparedBookingId = String(body.preparedBookingId || ""); if (!preparedBookingId) return errorResponse(400, "preparedBookingId is required."); const supabase = await createSupabaseServerClient(); const { data: ledger, error: ledgerError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").select("*").eq("customer_user_id", user.id).eq("prepared_booking_id", preparedBookingId).maybeSingle(); if (ledgerError) throw new Error(ledgerError.message); if (!ledger) return errorResponse(404, "Hotel booking not found.");
      let workingLedger = ledger;
      if (workingLedger.payment_provider === "mpesa" && workingLedger.payment_reference && workingLedger.payment_status !== "paid") { const mpesa = getPaymentAdapter("mpesa"); if (mpesa) { const mpesaStatus = await mpesa.getPaymentStatus(workingLedger.payment_reference); if (mpesaStatus === "succeeded") { const { data: refreshed } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({ payment_status: "paid", paid_at: new Date().toISOString(), metadata: { ...(workingLedger.metadata || {}), lastMpesaStatus: mpesaStatus } }).eq("id", workingLedger.id).select("*").single(); if (refreshed) workingLedger = refreshed; } } }
      if (workingLedger.payment_status !== "paid") return NextResponse.json({ provider: "mpesa", status: "payment_pending", ledger: publicHotelCheckoutLedger(workingLedger), supplierStatus: "awaiting_customer_payment" });
      if (!getConfiguredCredentials()) return NextResponse.json({ provider: "locktrip", status: "payment_pending", reconciliation: "awaiting_registered_provider_account", message: "Customer payment is recorded, but supplier confirmation requires SafariPlug's registered LockTrip account.", ledger: publicHotelCheckoutLedger(workingLedger) });
      const token = await getRegisteredLockTripToken();
      const metadata = workingLedger.metadata && typeof workingLedger.metadata === "object" && !Array.isArray(workingLedger.metadata) ? workingLedger.metadata as Record<string, unknown> : {};
      const details = await adapter.getBookingDetails(token, preparedBookingId); const providerStatus = String(details.status || "").toUpperCase(), paymentStatus = String(details.paymentStatus || "").toUpperCase();
      const confirmed = providerStatus === "DONE" && paymentStatus === "PAID", cancelled = providerStatus === "CANCELLED", failed = cancelled || providerStatus === "FAILED";
      if (confirmed || failed) {
        const updates: Record<string, unknown> = { metadata: { ...metadata, lastProviderStatus: details } };
        if (confirmed) { updates.payment_status = "paid"; updates.booking_status = "confirmed"; updates.supplier_settlement_status = "settled"; updates.provider_booking_reference = details.bookingReferenceId || null; updates.paid_at = details.confirmedAt || workingLedger.paid_at || new Date().toISOString(); updates.confirmed_at = details.confirmedAt || new Date().toISOString(); }
        else { updates.booking_status = cancelled ? "cancelled" : "failed"; updates.supplier_settlement_status = "failed"; }
        const { data: updatedLedger, error: updateError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update(updates).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single(); if (updateError) throw new Error(updateError.message);
        const storedTripId = typeof metadata.tripId === "string" ? metadata.tripId : null, tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : storedTripId; let itineraryItem = null; if (confirmed && tripId) itineraryItem = await attachConfirmedHotelToTrip({ supabase, userId: user.id, tripId, ledgerId: workingLedger.id, hotelName: details.hotel?.name || "Hotel stay", checkIn: details.checkIn || null, checkOut: details.checkOut || null, providerReference: details.bookingReferenceId || null, cityId: null });
        if (confirmed) {
          await emitConfirmedHotelBooking({
            provider: "locktrip",
            ledgerId: String(updatedLedger?.id || workingLedger.id),
            productId: `hotel-locktrip-${String(metadata.hotelId || workingLedger.quote_id || preparedBookingId)}`,
            confirmationRef: details.bookingReferenceId || null,
            value: Number(updatedLedger?.customer_retail_amount ?? workingLedger.customer_retail_amount ?? 0),
            currency: String(updatedLedger?.customer_currency || workingLedger.customer_currency || workingLedger.currency || "KES"),
            hotelName: details.hotel?.name || "Hotel stay",
            checkIn: details.checkIn || null,
            checkOut: details.checkOut || null,
          });
        }
        return NextResponse.json({ provider: "locktrip", status: confirmed ? "confirmed" : String(updates.booking_status), providerBooking: details, ledger: publicHotelCheckoutLedger(updatedLedger), itineraryItem });
      }
      const alreadyAccepted = typeof metadata.confirmAcceptedAt === "string";
      const alreadyIndeterminate = typeof metadata.confirmAttemptIndeterminateAt === "string";
      const alreadyRefused = typeof metadata.confirmRefusedAt === "string";
      if (!alreadyAccepted && !alreadyIndeterminate && !alreadyRefused) {
        const bookingInternalId = typeof metadata.bookingInternalId === "string" && metadata.bookingInternalId ? metadata.bookingInternalId : preparedBookingId;
        const confirmation = await adapter.confirmBooking(token, { bookingInternalId, quoteId: workingLedger.quote_id });
        const confirmationMetadata = { ...metadata, confirmResponse: confirmation, lastProviderStatus: details };
        if (confirmation.serviceUnavailable) {
          const { data: pendingLedger, error: pendingError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({ booking_status: "payment_pending", supplier_settlement_status: "pending", metadata: { ...confirmationMetadata, confirmAttemptIndeterminateAt: new Date().toISOString() } }).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single(); if (pendingError) throw new Error(pendingError.message);
          return NextResponse.json({ provider: "locktrip", status: "payment_pending", supplierStatus: "confirmation_indeterminate", message: confirmation.message || "LockTrip did not confirm the credit-line request. The booking will be re-checked before any retry.", providerBooking: details, ledger: publicHotelCheckoutLedger(pendingLedger) });
        }
        if (confirmation.accepted === false) {
          const { data: refusedLedger, error: refusedError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({ booking_status: "payment_pending", supplier_settlement_status: "failed", metadata: { ...confirmationMetadata, confirmRefusedAt: new Date().toISOString() } }).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single(); if (refusedError) throw new Error(refusedError.message);
          return NextResponse.json({ provider: "locktrip", status: "payment_pending", supplierStatus: "credit_line_refused", message: confirmation.message || "LockTrip refused supplier confirmation. Customer payment remains recorded; no automatic retry will be attempted.", providerBooking: details, ledger: publicHotelCheckoutLedger(refusedLedger) });
        }
        if (confirmation.accepted === true) {
          const { data: acceptedLedger, error: acceptedError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({ booking_status: "payment_pending", supplier_settlement_status: "pending", metadata: { ...confirmationMetadata, confirmAcceptedAt: new Date().toISOString(), voucherUrl: confirmation.voucherUrl || null } }).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single(); if (acceptedError) throw new Error(acceptedError.message);
          workingLedger = acceptedLedger || workingLedger;
        }
      }
      const refreshedDetails = await adapter.getBookingDetails(token, preparedBookingId); const refreshedStatus = String(refreshedDetails.status || "").toUpperCase(), refreshedPaymentStatus = String(refreshedDetails.paymentStatus || "").toUpperCase(); const refreshedConfirmed = refreshedStatus === "DONE" && refreshedPaymentStatus === "PAID";
      const latestMetadata = workingLedger.metadata && typeof workingLedger.metadata === "object" && !Array.isArray(workingLedger.metadata) ? workingLedger.metadata as Record<string, unknown> : metadata;
      const finalUpdates: Record<string, unknown> = { metadata: { ...latestMetadata, lastProviderStatus: refreshedDetails } };
      if (refreshedConfirmed) { finalUpdates.payment_status = "paid"; finalUpdates.booking_status = "confirmed"; finalUpdates.supplier_settlement_status = "settled"; finalUpdates.provider_booking_reference = refreshedDetails.bookingReferenceId || null; finalUpdates.paid_at = refreshedDetails.confirmedAt || workingLedger.paid_at || new Date().toISOString(); finalUpdates.confirmed_at = refreshedDetails.confirmedAt || new Date().toISOString(); }
      const { data: finalLedger, error: finalError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update(finalUpdates).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single(); if (finalError) throw new Error(finalError.message);
      const storedTripId = typeof latestMetadata.tripId === "string" ? latestMetadata.tripId : null, tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : storedTripId; let itineraryItem = null; if (refreshedConfirmed && tripId) itineraryItem = await attachConfirmedHotelToTrip({ supabase, userId: user.id, tripId, ledgerId: workingLedger.id, hotelName: refreshedDetails.hotel?.name || "Hotel stay", checkIn: refreshedDetails.checkIn || null, checkOut: refreshedDetails.checkOut || null, providerReference: refreshedDetails.bookingReferenceId || null, cityId: null });
      if (refreshedConfirmed) {
        await emitConfirmedHotelBooking({
          provider: "locktrip",
          ledgerId: String(finalLedger?.id || workingLedger.id),
          productId: `hotel-locktrip-${String(latestMetadata.hotelId || workingLedger.quote_id || preparedBookingId)}`,
          confirmationRef: refreshedDetails.bookingReferenceId || null,
          value: Number(finalLedger?.customer_retail_amount ?? workingLedger.customer_retail_amount ?? 0),
          currency: String(finalLedger?.customer_currency || workingLedger.customer_currency || workingLedger.currency || "KES"),
          hotelName: refreshedDetails.hotel?.name || "Hotel stay",
          checkIn: refreshedDetails.checkIn || null,
          checkOut: refreshedDetails.checkOut || null,
        });
      }
      return NextResponse.json({ provider: "locktrip", status: refreshedConfirmed ? "confirmed" : "payment_pending", supplierStatus: refreshedConfirmed ? "settled" : alreadyAccepted ? "confirmation_accepted_awaiting_supplier" : alreadyIndeterminate ? "confirmation_pending_recheck" : alreadyRefused ? "credit_line_refused" : "confirmation_pending", providerBooking: refreshedDetails, ledger: publicHotelCheckoutLedger(finalLedger), itineraryItem });
    }
    return errorResponse(400, "Unsupported LockTrip action.");
  } catch (error) { return errorResponse(502, error instanceof Error ? error.message : "LockTrip request failed."); }
}
