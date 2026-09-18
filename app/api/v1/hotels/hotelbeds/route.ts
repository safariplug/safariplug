import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";
import { openHotelbedsBookingToken, sealHotelbedsBookingToken } from "@/lib/integrations/hotels/hotelbeds-booking-token";
import { assertHotelbedsBookingRateReady, buildHotelbedsVoucher, hotelbedsRequiresCheckRate } from "@/lib/integrations/hotels/hotelbeds-certification";
import { resolveHotelbedsRateComments } from "@/lib/integrations/hotels/hotelbeds-rate-comments";
import { assertHotelbedsPreflightAccepted, mergeHotelbedsNotices } from "@/lib/integrations/hotels/hotelbeds-checkout-preflight";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { publicHotelCheckoutLedger } from "@/lib/integrations/hotels/hotel-public-ledger";
import { hotelPaymentSafeToRetry, normalizeHotelCheckoutIntentKey, publicHotelCheckoutIntentStatus } from "@/lib/integrations/hotels/hotel-payment-safety";

export const dynamic = "force-dynamic";
const DEFAULT_MARKUP_PERCENT = 10;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");

type Pax = { type?: "AD" | "CH"; name?: string; surname?: string; age?: number; roomId?: number };

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: "hotelbeds_error", message }, { status });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function markupPercent() {
  const parsed = Number(process.env.SAFARIPLUG_HOTEL_MARKUP_PERCENT || DEFAULT_MARKUP_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MARKUP_PERCENT;
}

function retailSupplierAmount(net: number, percent: number) {
  return Math.round(net * (1 + percent / 100) * 100) / 100;
}

function normalizePaxes(value: unknown): Pax[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("At least one passenger is required.");
  return value.map((row, index) => {
    const pax = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const name = String(pax.name || "").trim();
    const surname = String(pax.surname || "").trim();
    const type = String(pax.type || "AD").toUpperCase() === "CH" ? "CH" as const : "AD" as const;
    const age = pax.age === undefined || pax.age === null || pax.age === "" ? undefined : Number(pax.age);
    const roomId = Number.isInteger(Number(pax.roomId)) && Number(pax.roomId) > 0 ? Number(pax.roomId) : 1;
    if (!name || !surname) throw new Error(`Passenger ${index + 1} requires first and last name.`);
    if (type === "CH" && (!Number.isInteger(age) || Number(age) < 0 || Number(age) > 17)) throw new Error(`Passenger ${index + 1} requires a valid child age.`);
    return { type, name, surname, age, roomId };
  });
}

async function attachHotelToTrip(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  tripId: string;
  ledgerId: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  providerReference: string;
}) {
  const { supabase, userId, tripId, ledgerId, hotelName, checkIn, checkOut, providerReference } = params;
  const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).eq("traveler_id", userId).maybeSingle();
  if (!trip) return null;
  const { data: existing } = await supabase.from("trip_items").select("id").eq("trip_id", tripId).eq("hotel_booking_pricing_ledger_id", ledgerId).maybeSingle();
  if (existing) return existing;
  const { count } = await supabase.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const { data, error } = await supabase.from("trip_items").insert({
    trip_id: tripId,
    item_kind: "hotel",
    booking_id: null,
    hotel_booking_pricing_ledger_id: ledgerId,
    position: count ?? 0,
    start_at: checkIn,
    end_at: checkOut,
    title: hotelName,
    notes: `Hotelbeds reference: ${providerReference}`,
  }).select("id,trip_id,item_kind,title,start_at,end_at,hotel_booking_pricing_ledger_id").single();
  if (error) throw new Error(`Hotel booking confirmed, but itinerary attachment failed: ${error.message}`);
  return data;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return errorResponse(401, "Authentication required.");
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch { return errorResponse(400, "Invalid JSON body."); }
  const action = String(body.action || "");
  const adapter = new HotelbedsHotelAdapter();
  const supabase = await createSupabaseServerClient();

  try {
    if (action === "preflight") {
      const rawToken = String(body.bookingToken || "");
      if (!rawToken) return errorResponse(400, "bookingToken is required.");
      const original = openHotelbedsBookingToken(rawToken);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") return errorResponse(400, "Hotel M-Pesa checkout currently supports KES only.");

      if (original.preflighted) {
        const percent = markupPercent();
        const supplierRetail = retailSupplierAmount(original.supplierNet, percent);
        const converted = await convertCurrency(supplierRetail, original.supplierCurrency, customerCurrency);
        return NextResponse.json({
          provider: "hotelbeds",
          status: "preflight_ready",
          bookingToken: rawToken,
          pricing: { customerRetailAmount: converted.amount, customerCurrency, markupPercent: percent },
          rate: {
            rateType: original.rateType,
            roomName: original.roomName,
            boardName: original.boardName,
            cancellation: original.cancellation,
            notices: original.notices || [],
            checkRateCompleted: original.checkRateCompleted === true,
          },
        });
      }

      let final = original;
      let checkRateCompleted = false;
      if (hotelbedsRequiresCheckRate(original.rateType)) {
        const checked = await adapter.checkRateSelection(original.rateKey);
        final = {
          ...original,
          ...checked,
          supplierCurrency: checked.supplierCurrency,
          supplierNet: checked.supplierNet,
        };
        checkRateCompleted = true;
      }

      let resolvedNotices: string[] = [];
      if (final.rateCommentsId && !hotelbedsRequiresCheckRate(original.rateType)) {
        const resolved = await resolveHotelbedsRateComments({ rateCommentsId: final.rateCommentsId, checkIn: final.checkIn });
        resolvedNotices = resolved.notices;
      }
      const notices = mergeHotelbedsNotices(final.notices, resolvedNotices);
      assertHotelbedsBookingRateReady({ rateKey: final.rateKey, rateType: final.rateType }, checkRateCompleted);
      const preflightedAt = new Date().toISOString();
      const governedToken = sealHotelbedsBookingToken({
        rateKey: final.rateKey,
        rateType: final.rateType,
        rateClass: final.rateClass || null,
        supplierNet: final.supplierNet,
        supplierCurrency: final.supplierCurrency,
        propertyId: final.propertyId,
        propertyName: final.propertyName,
        hotelAddress: final.hotelAddress || null,
        hotelCategory: final.hotelCategory || null,
        hotelDestination: final.hotelDestination || null,
        roomId: final.roomId || null,
        roomName: final.roomName || null,
        boardCode: final.boardCode || null,
        boardName: final.boardName || null,
        cancellation: final.cancellation || null,
        notices,
        rateCommentsId: final.rateCommentsId || null,
        preflighted: true,
        checkRateCompleted,
        preflightedAt,
        checkIn: final.checkIn,
        checkOut: final.checkOut,
      });
      const percent = markupPercent();
      const supplierRetail = retailSupplierAmount(final.supplierNet, percent);
      const converted = await convertCurrency(supplierRetail, final.supplierCurrency, customerCurrency);
      return NextResponse.json({
        provider: "hotelbeds",
        status: "preflight_ready",
        bookingToken: governedToken,
        pricing: { customerRetailAmount: converted.amount, customerCurrency, markupPercent: percent },
        rate: { rateType: final.rateType, roomName: final.roomName, boardName: final.boardName, cancellation: final.cancellation, notices, checkRateCompleted },
      });
    }

    if (action === "prepare") {
      const rawToken = String(body.bookingToken || "");
      if (!rawToken) return errorResponse(400, "bookingToken is required.");
      const intentKey = normalizeHotelCheckoutIntentKey(body.idempotencyKey);
      const final = openHotelbedsBookingToken(rawToken);
      const paxes = normalizePaxes(body.paxes);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") return errorResponse(400, "Hotel M-Pesa checkout currently supports KES only.");
      assertHotelbedsPreflightAccepted({
        preflighted: final.preflighted === true,
        termsAccepted: body.termsAccepted === true,
        rateType: final.rateType,
        checkRateCompleted: final.checkRateCompleted === true,
      });
      const checkRateCompleted = final.checkRateCompleted === true;
      assertHotelbedsBookingRateReady({ rateKey: final.rateKey, rateType: final.rateType }, checkRateCompleted);

      const phone = String(body.customerPhone || "").trim();
      if (!phone) return errorResponse(400, "A customer M-Pesa phone number is required.");
      const mpesa = getPaymentAdapter("mpesa");
      if (!mpesa) return errorResponse(503, "M-Pesa is not configured yet.");

      const { data: existingIntent, error: existingIntentError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .select("*")
        .eq("customer_user_id", user.id)
        .eq("provider", "hotelbeds")
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
          provider: "hotelbeds",
          ...publicState,
          paymentReused: true,
          ledger: publicHotelCheckoutLedger(existingLedger.data),
          message:
            publicState.reconciliation === "manual_required"
              ? "SafariPlug will not submit another supplier/payment request automatically because the previous attempt is indeterminate."
              : undefined,
        });
      }

      const { data: intent, error: intentError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .insert({
          customer_user_id: user.id,
          provider: "hotelbeds",
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
            .eq("provider", "hotelbeds")
            .eq("intent_key", intentKey)
            .maybeSingle();
          if (racedIntent) {
            return NextResponse.json({
              provider: "hotelbeds",
              ...publicHotelCheckoutIntentStatus(
                racedIntent.state,
                racedIntent.prepared_booking_id
              ),
              paymentReused: true,
            });
          }
        }
        throw new Error(intentError?.message || "Unable to initialize Hotelbeds checkout.");
      }

      const percent = markupPercent();
      const supplierRetail = retailSupplierAmount(final.supplierNet, percent);
      const converted = await convertCurrency(supplierRetail, final.supplierCurrency, customerCurrency);
      const bookingId = `hotelbeds-${randomUUID()}`;
      const tripId = typeof body.tripId === "string" && body.tripId ? body.tripId : null;
      const holder = paxes.find((pax) => pax.type === "AD") || paxes[0];

      const { data: ledger, error: ledgerError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .insert({
          customer_user_id: user.id,
          provider: "hotelbeds",
          checkout_intent_key: intentKey,
          quote_id: final.rateKey,
          prepared_booking_id: bookingId,
          currency: customerCurrency,
          supplier_currency: final.supplierCurrency,
          customer_currency: customerCurrency,
          exchange_rate: converted.rate,
          supplier_net_amount: final.supplierNet,
          retail_amount: supplierRetail,
          customer_retail_amount: converted.amount,
          markup_percent: percent,
          payment_status: "unpaid",
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: {
            bookingToken: rawToken,
            checkRateCompleted,
            preflightedAt: final.preflightedAt || null,
            termsAcceptedAt: new Date().toISOString(),
            tripId,
            paxes,
            holder: { name: holder.name, surname: holder.surname },
            hotelName: final.propertyName,
            checkIn: final.checkIn,
            checkOut: final.checkOut,
            cancellation: final.cancellation || null,
            notices: final.notices || [],
          },
        })
        .select("*")
        .single();

      if (ledgerError || !ledger) {
        await supabaseAdmin
          .from("hotel_checkout_intents")
          .update({ state: "failed", last_error: ledgerError?.message || "ledger_create_failed" })
          .eq("id", intent.id);
        throw new Error(ledgerError?.message || "Unable to create Hotelbeds pricing ledger entry.");
      }

      await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          ledger_id: ledger.id,
          prepared_booking_id: bookingId,
          state: "supplier_prepared",
        })
        .eq("id", intent.id);

      const paymentStartedAt = new Date().toISOString();
      const { data: claimedIntent, error: claimError } = await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "payment_initializing",
          payment_initiation_started_at: paymentStartedAt,
        })
        .eq("id", intent.id)
        .is("payment_initiation_started_at", null)
        .select("*")
        .maybeSingle();
      if (claimError) throw new Error(claimError.message);
      if (!claimedIntent) {
        return NextResponse.json({
          provider: "hotelbeds",
          status: "checkout_initializing",
          bookingId,
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
          customerEmail: user.email,
          customerPhone: phone,
          returnUrl: `${SITE_URL}/hotels/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(bookingId)}${tripId ? `&tripId=${encodeURIComponent(tripId)}` : ""}`,
          idempotencyKey: `hotelbeds:${intentKey}`,
          callbackUrl: `${SITE_URL}/api/v1/hotels/mpesa/callback`,
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
          provider: "hotelbeds",
          status: "payment_initiation_indeterminate",
          bookingId,
          reconciliation: "manual_required",
          ledger: publicHotelCheckoutLedger(ledger),
          message:
            "SafariPlug could not prove whether the M-Pesa request was created. It will not submit another payment request automatically because that could cause a duplicate charge.",
        });
      }

      const { data: updated } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          payment_provider: "mpesa",
          payment_reference: payment.providerReference,
          payment_status: "pending",
          metadata: { ...(ledger.metadata || {}), mpesaPaymentId: payment.id },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();

      await supabaseAdmin
        .from("hotel_checkout_intents")
        .update({
          state: "payment_pending",
          last_error: null,
        })
        .eq("id", intent.id);

      return NextResponse.json({
        provider: "hotelbeds",
        status: "payment_pending",
        bookingId,
        pricing: { supplierNetAmount: final.supplierNet, customerRetailAmount: converted.amount, supplierCurrency: final.supplierCurrency, customerCurrency, exchangeRate: converted.rate, markupPercent: percent },
        rate: { rateType: final.rateType, roomName: final.roomName, boardName: final.boardName, cancellation: final.cancellation, notices: final.notices || [] },
        ledger: publicHotelCheckoutLedger(updated || ledger),
        payment,
      });
    }

    const bookingId = String(body.bookingId || body.preparedBookingId || "");
    if (!bookingId) return errorResponse(400, "bookingId is required.");
    const { data: ledger, error: ledgerError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").select("*").eq("customer_user_id", user.id).eq("provider", "hotelbeds").eq("prepared_booking_id", bookingId).maybeSingle();
    if (ledgerError) throw new Error(ledgerError.message);
    if (!ledger) return errorResponse(404, "Hotelbeds booking not found.");
    const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata as Record<string, unknown> : {};

    if (action === "voucher") {
      if (ledger.booking_status !== "confirmed") return errorResponse(409, "Voucher is available only after confirmation.");
      return NextResponse.json({ provider: "hotelbeds", voucher: metadata.voucher || null });
    }

    if (action === "cancel_preview") {
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) return errorResponse(409, "Only confirmed bookings can be cancelled.");
      const preview = await adapter.cancelBooking(ledger.provider_booking_reference, "SIMULATION");
      return NextResponse.json({ provider: "hotelbeds", status: "simulation", preview });
    }

    if (action === "cancel") {
      if (body.confirmCancellation !== true) return errorResponse(400, "Explicit cancellation confirmation is required.");
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) return errorResponse(409, "Only confirmed bookings can be cancelled.");
      const preview = await adapter.cancelBooking(ledger.provider_booking_reference, "SIMULATION");
      const cancelled = await adapter.cancelBooking(ledger.provider_booking_reference, "CANCELLATION");
      const { data: updatedLedger } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({
        booking_status: "cancelled",
        metadata: { ...metadata, cancellationPreview: preview, cancellationResponse: cancelled, cancelledAt: new Date().toISOString(), refundStatus: "not_automated" },
      }).eq("id", ledger.id).select("*").single();
      return NextResponse.json({ provider: "hotelbeds", status: "cancelled", preview, providerBooking: cancelled, ledger: publicHotelCheckoutLedger(updatedLedger), refund: "Any customer refund due is handled separately; supplier cancellation does not automatically issue an M-Pesa refund." });
    }

    if (action !== "status") return errorResponse(400, "Unsupported Hotelbeds action.");

    let workingLedger = ledger;
    if (workingLedger.payment_provider === "mpesa" && workingLedger.payment_reference && workingLedger.payment_status !== "paid") {
      const mpesa = getPaymentAdapter("mpesa");
      if (mpesa) {
        const status = await mpesa.getPaymentStatus(workingLedger.payment_reference);
        const paymentUpdate: Record<string, unknown> = { payment_status: status === "succeeded" ? "paid" : status === "failed" ? "failed" : "pending", metadata: { ...metadata, lastMpesaStatus: status } };
        if (status === "succeeded") paymentUpdate.paid_at = new Date().toISOString();
        if (status === "failed") paymentUpdate.booking_status = "failed";
        const { data: refreshed } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update(paymentUpdate).eq("id", workingLedger.id).select("*").single();
        if (refreshed) workingLedger = refreshed;
      }
    }

    if (workingLedger.payment_status === "failed") return NextResponse.json({ provider: "hotelbeds", status: "failed", ledger: publicHotelCheckoutLedger(workingLedger), message: "M-Pesa payment failed; Hotelbeds was not booked." });
    if (workingLedger.payment_status !== "paid") return NextResponse.json({ provider: "hotelbeds", status: "payment_pending", ledger: publicHotelCheckoutLedger(workingLedger), supplierStatus: "awaiting_customer_payment" });
    if (workingLedger.booking_status === "confirmed") {
      return NextResponse.json({ provider: "hotelbeds", status: "confirmed", ledger: publicHotelCheckoutLedger(workingLedger), voucher: (workingLedger.metadata as Record<string, unknown> | null)?.voucher || null, providerBooking: (workingLedger.metadata as Record<string, unknown> | null)?.providerBooking || null });
    }

    const currentMetadata = workingLedger.metadata && typeof workingLedger.metadata === "object" && !Array.isArray(workingLedger.metadata) ? workingLedger.metadata as Record<string, unknown> : {};
    if (currentMetadata.confirmAttemptIndeterminateAt) {
      return NextResponse.json({ provider: "hotelbeds", status: "payment_pending", supplierStatus: "confirmation_indeterminate", reconciliation: "manual_required", ledger: publicHotelCheckoutLedger(workingLedger), message: "Payment succeeded, but Hotelbeds confirmation returned an indeterminate result. SafariPlug will not retry blindly because that could create a duplicate reservation." });
    }

    const bookingToken = String(currentMetadata.bookingToken || "");
    const token = openHotelbedsBookingToken(bookingToken);
    const checkRateCompleted = currentMetadata.checkRateCompleted === true;
    assertHotelbedsBookingRateReady({ rateKey: token.rateKey, rateType: token.rateType }, checkRateCompleted);
    const paxes = normalizePaxes(currentMetadata.paxes);
    const holderRaw = currentMetadata.holder && typeof currentMetadata.holder === "object" ? currentMetadata.holder as Record<string, unknown> : {};
    const holder = { name: String(holderRaw.name || paxes[0].name || ""), surname: String(holderRaw.surname || paxes[0].surname || "") };
    const grouped = new Map<number, Pax[]>();
    for (const pax of paxes) grouped.set(pax.roomId || 1, [...(grouped.get(pax.roomId || 1) || []), pax]);
    const rooms = [...grouped.entries()].map(([roomId, passengers]) => ({
      rateKey: token.rateKey,
      paxes: passengers.map((pax) => ({ roomId, type: pax.type || "AD", name: pax.name || "", surname: pax.surname || "", ...(pax.type === "CH" && pax.age !== undefined ? { age: pax.age } : {}) })),
    }));
    const clientReference = `SP-${workingLedger.id.slice(0, 18)}`;

    try {
      const provider = await adapter.createBooking({ holder, rooms, clientReference });
      const reference = provider.booking?.reference;
      if (!reference) throw new Error("Hotelbeds did not return a booking reference.");
      const roomType = token.roomName || token.roomId || "Hotel room";
      const boardType = token.boardName || token.boardCode || "Room only";
      const voucher = buildHotelbedsVoucher({
        bookingReference: reference,
        agencyReference: clientReference,
        hotelName: token.propertyName,
        hotelAddress: token.hotelAddress || token.hotelDestination || "See confirmed hotel details",
        hotelCategory: token.hotelCategory || null,
        hotelDestination: token.hotelDestination || null,
        holderName: `${holder.name} ${holder.surname}`.trim(),
        checkIn: token.checkIn,
        checkOut: token.checkOut,
        supplierName: "HBX Group",
        rooms: rooms.map((room) => ({ roomType, boardType, passengers: room.paxes.map((pax) => ({ name: `${pax.name} ${pax.surname}`.trim(), type: pax.type, age: pax.age })), rateComments: token.notices || [] })),
      });
      const confirmedAt = new Date().toISOString();
      const tripId = typeof currentMetadata.tripId === "string" ? currentMetadata.tripId : null;
      let itineraryItem = null;
      if (tripId) itineraryItem = await attachHotelToTrip({ supabase, userId: user.id, tripId, ledgerId: workingLedger.id, hotelName: token.propertyName, checkIn: token.checkIn, checkOut: token.checkOut, providerReference: reference });
      const { data: updatedLedger, error: updateError } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({
        provider_booking_reference: reference,
        booking_status: "confirmed",
        supplier_settlement_status: "settled",
        confirmed_at: confirmedAt,
        metadata: { ...currentMetadata, confirmAcceptedAt: confirmedAt, providerBooking: provider, voucher, clientReference },
      }).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single();
      if (updateError) throw new Error(updateError.message);
      return NextResponse.json({ provider: "hotelbeds", status: "confirmed", providerBooking: provider, voucher, ledger: publicHotelCheckoutLedger(updatedLedger), itineraryItem });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Hotelbeds confirmation returned an unknown result.";
      const { data: pendingLedger } = await supabaseAdmin.from("hotel_booking_pricing_ledger").update({
        booking_status: "payment_pending",
        supplier_settlement_status: "pending",
        metadata: { ...currentMetadata, confirmAttemptIndeterminateAt: timestamp, confirmAttemptError: message },
      }).eq("id", workingLedger.id).eq("customer_user_id", user.id).select("*").single();
      return NextResponse.json({ provider: "hotelbeds", status: "payment_pending", supplierStatus: "confirmation_indeterminate", reconciliation: "manual_required", ledger: publicHotelCheckoutLedger(pendingLedger || workingLedger), message: "Payment succeeded, but Hotelbeds confirmation could not be proven. SafariPlug will not retry automatically because a duplicate booking could result." });
    }
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : "Hotelbeds checkout failed.");
  }
}
