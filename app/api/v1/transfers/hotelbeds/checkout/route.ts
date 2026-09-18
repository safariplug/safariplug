import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createHotelbedsTransferBooking,
  getHotelbedsTransferBooking,
  cancelHotelbedsTransferBooking,
} from "@/lib/integrations/hotelbeds/transfers";
import {
  buildHotelbedsTransferBookingRequest,
  hotelbedsTransferBookingReference,
  normalizeHotelbedsTransferHolder,
} from "@/lib/integrations/hotelbeds/transfer-checkout";
import { openHotelbedsTransferSelectionToken } from "@/lib/integrations/hotelbeds/transfer-selection-token";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { assertTravelerVerified, travelerVerificationErrorResponse } from "@/lib/services/traveler-verification";
import { normalizeTransferCheckoutIntentKey, transferPaymentSafeToRetry } from "@/lib/integrations/hotelbeds/transfer-payment-safety";

export const dynamic = "force-dynamic";

const DEFAULT_MARKUP_PERCENT = 10;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: "hotelbeds_transfers_checkout_error", message }, { status });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function markupPercent() {
  const parsed = Number(
    process.env.SAFARIPLUG_TRANSFER_HOTELBEDS_MARKUP_PERCENT ||
      process.env.SAFARIPLUG_TRANSFER_MARKUP_PERCENT ||
      DEFAULT_MARKUP_PERCENT
  );
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MARKUP_PERCENT;
}

function retailSupplierAmount(amount: number, percent: number) {
  return Math.round(amount * (1 + percent / 100) * 100) / 100;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return errorResponse(401, "Authentication required.");

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  const action = String(body.action || "").trim().toLowerCase();
  const supabase = await createSupabaseServerClient();

  try {
    if (action === "preflight") {
      const selectionToken = String(body.selectionToken || "");
      if (!selectionToken) return errorResponse(400, "selectionToken is required.");
      const selection = openHotelbedsTransferSelectionToken(selectionToken);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") {
        return errorResponse(400, "Hotelbeds Transfers M-Pesa checkout currently supports KES only.");
      }

      const percent = markupPercent();
      const supplierRetail = retailSupplierAmount(selection.supplierAmount, percent);
      const converted = await convertCurrency(
        supplierRetail,
        selection.supplierCurrency,
        customerCurrency
      );

      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "preflight_ready",
        selectionToken,
        bookingCreated: false,
        paymentCharged: false,
        pricing: {
          supplierAmount: selection.supplierAmount,
          supplierCurrency: selection.supplierCurrency,
          customerRetailAmount: converted.amount,
          customerCurrency,
          exchangeRate: converted.rate,
          markupPercent: percent,
        },
        route: {
          from: { type: selection.fromType, code: selection.fromCode },
          to: { type: selection.toType, code: selection.toCode },
          outbound: selection.outbound,
          inbound: selection.inbound || null,
          adults: selection.adults,
          children: selection.children,
          infants: selection.infants,
        },
        cancellationPolicies: selection.cancellationPolicies || [],
        service: selection.serviceSummary || {},
        termsRequired: true,
      });
    }

    if (action === "prepare") {
      await assertTravelerVerified(user.id);
      const selectionToken = String(body.selectionToken || "");
      if (!selectionToken) return errorResponse(400, "selectionToken is required.");
      const intentKey = normalizeTransferCheckoutIntentKey(body.idempotencyKey);
      if (body.termsAccepted !== true) {
        return errorResponse(400, "Accept the transfer rate and cancellation terms before payment.");
      }

      const mpesa = getPaymentAdapter("mpesa");
      if (!mpesa) return errorResponse(503, "M-Pesa is not configured yet.");

      const { data: existingIntent, error: existingIntentError } = await supabase
        .from("transfer_booking_pricing_ledger")
        .select("*")
        .eq("customer_user_id", user.id)
        .eq("provider", "hotelbeds")
        .eq("checkout_intent_key", intentKey)
        .maybeSingle();

      if (existingIntentError) throw new Error(existingIntentError.message);
      if (existingIntent) {
        const existingMetadata = metadataRecord(existingIntent.metadata);
        return NextResponse.json({
          provider: "hotelbeds",
          product: "transfers",
          status:
            existingIntent.payment_status === "paid"
              ? existingIntent.booking_status
              : existingIntent.payment_reference
                ? "payment_pending"
                : existingMetadata.paymentInitiationIndeterminateAt
                  ? "payment_initiation_indeterminate"
                  : "payment_initializing",
          bookingId: existingIntent.prepared_booking_id,
          bookingCreated: existingIntent.booking_status === "confirmed",
          paymentReused: true,
          supplierStatus:
            existingMetadata.paymentInitiationIndeterminateAt
              ? "payment_initiation_indeterminate"
              : "existing_checkout_intent",
          reconciliation: existingMetadata.paymentInitiationIndeterminateAt
            ? "manual_required"
            : undefined,
        });
      }

      const selection = openHotelbedsTransferSelectionToken(selectionToken);
      const holder = normalizeHotelbedsTransferHolder(body.holder);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") {
        return errorResponse(400, "Hotelbeds Transfers M-Pesa checkout currently supports KES only.");
      }

      const phone = String(body.customerPhone || holder.phone || "").trim();
      if (!phone) return errorResponse(400, "A customer M-Pesa phone number is required.");

      const percent = markupPercent();
      const supplierRetail = retailSupplierAmount(selection.supplierAmount, percent);
      const converted = await convertCurrency(
        supplierRetail,
        selection.supplierCurrency,
        customerCurrency
      );

      const preparedBookingId = `hotelbeds-transfer-${randomUUID()}`;
      const bookingRequest = buildHotelbedsTransferBookingRequest({
        rateKey: selection.rateKey,
        holder,
        language: String(body.language || "en").slice(0, 5),
        transferDetails: body.transferDetails,
        welcomeMessage: typeof body.welcomeMessage === "string" ? body.welcomeMessage : undefined,
        remark: typeof body.remark === "string" ? body.remark : undefined,
        clientReference: `SPT-${preparedBookingId.slice(-18)}`,
      });

      const { data: ledger, error: ledgerError } = await supabase
        .from("transfer_booking_pricing_ledger")
        .insert({
          customer_user_id: user.id,
          provider: "hotelbeds",
          checkout_intent_key: intentKey,
          prepared_booking_id: preparedBookingId,
          supplier_currency: selection.supplierCurrency,
          customer_currency: customerCurrency,
          exchange_rate: converted.rate,
          supplier_amount: selection.supplierAmount,
          retail_amount: converted.amount,
          markup_percent: percent,
          payment_status: "unpaid",
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: {
            selectionToken,
            holder,
            bookingRequest,
            termsAcceptedAt: new Date().toISOString(),
            route: {
              from: { type: selection.fromType, code: selection.fromCode },
              to: { type: selection.toType, code: selection.toCode },
              outbound: selection.outbound,
              inbound: selection.inbound || null,
            },
            cancellationPolicies: selection.cancellationPolicies || [],
            service: selection.serviceSummary || {},
          },
        })
        .select("*")
        .single();

      if (ledgerError || !ledger) {
        if (ledgerError?.code === "23505") {
          const { data: racedIntent, error: racedIntentError } = await supabase
            .from("transfer_booking_pricing_ledger")
            .select("*")
            .eq("customer_user_id", user.id)
            .eq("provider", "hotelbeds")
            .eq("checkout_intent_key", intentKey)
            .maybeSingle();
          if (racedIntentError) throw new Error(racedIntentError.message);
          if (racedIntent) {
            return NextResponse.json({
              provider: "hotelbeds",
              product: "transfers",
              status: "payment_initializing",
              bookingId: racedIntent.prepared_booking_id,
              bookingCreated: racedIntent.booking_status === "confirmed",
              paymentReused: true,
              supplierStatus: "existing_checkout_intent",
            });
          }
        }
        throw new Error(
          ledgerError?.message || "Unable to create transfer checkout ledger entry."
        );
      }

      const paymentInitiationStartedAt = new Date().toISOString();
      const { data: claimedLedger, error: claimError } = await supabase
        .from("transfer_booking_pricing_ledger")
        .update({
          payment_status: "pending",
          payment_initiation_started_at: paymentInitiationStartedAt,
          metadata: {
            ...metadataRecord(ledger.metadata),
            paymentInitiationStartedAt,
          },
        })
        .eq("id", ledger.id)
        .eq("customer_user_id", user.id)
        .eq("payment_status", "unpaid")
        .is("payment_reference", null)
        .is("payment_initiation_started_at", null)
        .select("*")
        .maybeSingle();

      if (claimError) throw new Error(claimError.message);
      if (!claimedLedger) {
        return NextResponse.json({
          provider: "hotelbeds",
          product: "transfers",
          status: "payment_initializing",
          bookingId: preparedBookingId,
          bookingCreated: false,
          paymentReused: true,
          supplierStatus: "existing_payment_initiation",
        });
      }

      let payment;
      try {
        payment = await mpesa.createPaymentIntent({
          appointmentId: ledger.id,
          amount: converted.amount,
          currency: customerCurrency,
          customerEmail: user.email,
          customerPhone: phone,
          returnUrl: `${SITE_URL}/account?transferBooking=${encodeURIComponent(preparedBookingId)}`,
          idempotencyKey: `hotelbeds-transfer:${intentKey}`,
          callbackUrl: `${SITE_URL}/api/v1/transfers/hotelbeds/mpesa/callback`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "M-Pesa payment initiation failed.";
        if (transferPaymentSafeToRetry(error)) {
          await supabase
            .from("transfer_booking_pricing_ledger")
            .update({
              payment_status: "unpaid",
              payment_initiation_started_at: null,
              metadata: {
                ...metadataRecord(claimedLedger.metadata),
                paymentInitiationSafeFailureAt: new Date().toISOString(),
                paymentInitiationError: message,
              },
            })
            .eq("id", ledger.id)
            .eq("customer_user_id", user.id);
          throw error;
        }

        await supabase
          .from("transfer_booking_pricing_ledger")
          .update({
            payment_status: "pending",
            metadata: {
              ...metadataRecord(claimedLedger.metadata),
              paymentInitiationIndeterminateAt: new Date().toISOString(),
              paymentInitiationError: message,
            },
          })
          .eq("id", ledger.id)
          .eq("customer_user_id", user.id);

        return NextResponse.json({
          provider: "hotelbeds",
          product: "transfers",
          status: "payment_initiation_indeterminate",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierStatus: "payment_initiation_indeterminate",
          reconciliation: "manual_required",
          message:
            "SafariPlug could not prove whether the M-Pesa request was created. It will not submit another payment request automatically because that could cause a duplicate charge.",
        });
      }

      const { data: updated } = await supabase
        .from("transfer_booking_pricing_ledger")
        .update({
          payment_provider: "mpesa",
          payment_reference: payment.providerReference,
          payment_status: "pending",
          metadata: {
            ...metadataRecord(claimedLedger.metadata),
            mpesaPaymentId: payment.id,
          },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();

      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "payment_pending",
        bookingId: preparedBookingId,
        bookingCreated: false,
        supplierStatus: "awaiting_customer_payment",
        pricing: {
          supplierAmount: selection.supplierAmount,
          supplierCurrency: selection.supplierCurrency,
          customerRetailAmount: converted.amount,
          customerCurrency,
          exchangeRate: converted.rate,
          markupPercent: percent,
        },
        payment,
        ledger: updated || ledger,
      });
    }

    const bookingId = String(body.bookingId || body.preparedBookingId || "");
    if (!bookingId) return errorResponse(400, "bookingId is required.");

    const { data: ledger, error: ledgerError } = await supabase
      .from("transfer_booking_pricing_ledger")
      .select("*")
      .eq("customer_user_id", user.id)
      .eq("provider", "hotelbeds")
      .eq("prepared_booking_id", bookingId)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);
    if (!ledger) return errorResponse(404, "Hotelbeds transfer checkout not found.");

    const metadata = metadataRecord(ledger.metadata);

    if (action === "detail") {
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) {
        return errorResponse(409, "Booking details are available only after confirmation.");
      }
      const providerBooking = await getHotelbedsTransferBooking(
        ledger.provider_booking_reference,
        String(body.language || "en").slice(0, 5)
      );
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "confirmed",
        providerBooking,
      });
    }

    if (action === "cancel_preview") {
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) {
        return errorResponse(409, "Only confirmed transfer bookings can be cancelled.");
      }
      const preview = await cancelHotelbedsTransferBooking(
        ledger.provider_booking_reference,
        true,
        String(body.language || "en").slice(0, 5)
      );
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "simulation",
        preview,
        cancelled: false,
      });
    }

    if (action === "cancel") {
      if (body.confirmCancellation !== true) {
        return errorResponse(400, "Explicit cancellation confirmation is required.");
      }
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) {
        return errorResponse(409, "Only confirmed transfer bookings can be cancelled.");
      }

      const language = String(body.language || "en").slice(0, 5);
      const preview = await cancelHotelbedsTransferBooking(
        ledger.provider_booking_reference,
        true,
        language
      );
      const cancelled = await cancelHotelbedsTransferBooking(
        ledger.provider_booking_reference,
        false,
        language
      );
      const { data: updated } = await supabase
        .from("transfer_booking_pricing_ledger")
        .update({
          booking_status: "cancelled",
          metadata: {
            ...metadata,
            cancellationPreview: preview,
            cancellationResponse: cancelled,
            cancelledAt: new Date().toISOString(),
            refundStatus: "not_automated",
          },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();

      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "cancelled",
        preview,
        providerBooking: cancelled,
        ledger: updated || ledger,
        refund:
          "Supplier cancellation does not automatically issue an M-Pesa refund. Any customer refund due is handled separately.",
      });
    }

    if (action !== "status") {
      return errorResponse(400, "Unsupported Hotelbeds Transfers checkout action.");
    }

    let workingLedger = ledger;
    if (
      workingLedger.payment_provider === "mpesa" &&
      workingLedger.payment_reference &&
      workingLedger.payment_status !== "paid"
    ) {
      const mpesa = getPaymentAdapter("mpesa");
      if (mpesa) {
        const paymentStatus = await mpesa.getPaymentStatus(
          workingLedger.payment_reference
        );
        const update: Record<string, unknown> = {
          payment_status:
            paymentStatus === "succeeded"
              ? "paid"
              : paymentStatus === "failed"
                ? "failed"
                : "pending",
          metadata: { ...metadata, lastMpesaStatus: paymentStatus },
        };
        if (paymentStatus === "succeeded") update.paid_at = new Date().toISOString();
        if (paymentStatus === "failed") update.booking_status = "failed";

        const { data: refreshed } = await supabase
          .from("transfer_booking_pricing_ledger")
          .update(update)
          .eq("id", workingLedger.id)
          .select("*")
          .single();
        if (refreshed) workingLedger = refreshed;
      }
    }

    if (workingLedger.payment_status === "failed") {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "failed",
        bookingCreated: false,
        ledger: workingLedger,
        message: "M-Pesa payment failed; Hotelbeds was not booked.",
      });
    }

    if (workingLedger.payment_status !== "paid") {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "awaiting_customer_payment",
        ledger: workingLedger,
      });
    }

    if (workingLedger.booking_status === "confirmed") {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "confirmed",
        bookingCreated: true,
        ledger: workingLedger,
        providerBooking: metadataRecord(workingLedger.metadata).providerBooking || null,
      });
    }

    const currentMetadata = metadataRecord(workingLedger.metadata);
    if (currentMetadata.confirmAttemptIndeterminateAt) {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "confirmation_indeterminate",
        reconciliation: "manual_required",
        ledger: workingLedger,
        message:
          "Payment succeeded, but Hotelbeds confirmation returned an indeterminate result. SafariPlug will not retry blindly because that could create a duplicate transfer booking.",
      });
    }

    const bookingRequest = metadataRecord(currentMetadata.bookingRequest);
    if (!Array.isArray(bookingRequest.transfers) || !bookingRequest.holder) {
      return errorResponse(409, "Stored Hotelbeds transfer booking request is incomplete.");
    }

    try {
      const providerBooking = await createHotelbedsTransferBooking(bookingRequest);
      const reference = hotelbedsTransferBookingReference(providerBooking);
      if (!reference) {
        throw new Error("Hotelbeds did not return a transfer booking reference.");
      }
      const confirmedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("transfer_booking_pricing_ledger")
        .update({
          provider_booking_reference: reference,
          booking_status: "confirmed",
          supplier_settlement_status: "settled",
          confirmed_at: confirmedAt,
          metadata: {
            ...currentMetadata,
            confirmAcceptedAt: confirmedAt,
            providerBooking,
          },
        })
        .eq("id", workingLedger.id)
        .eq("customer_user_id", user.id)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "confirmed",
        bookingCreated: true,
        bookingReference: reference,
        providerBooking,
        ledger: updated,
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const message =
        error instanceof Error
          ? error.message
          : "Hotelbeds transfer confirmation returned an unknown result.";
      const { data: pending } = await supabase
        .from("transfer_booking_pricing_ledger")
        .update({
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: {
            ...currentMetadata,
            confirmAttemptIndeterminateAt: timestamp,
            confirmAttemptError: message,
          },
        })
        .eq("id", workingLedger.id)
        .eq("customer_user_id", user.id)
        .select("*")
        .single();

      return NextResponse.json({
        provider: "hotelbeds",
        product: "transfers",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "confirmation_indeterminate",
        reconciliation: "manual_required",
        ledger: pending || workingLedger,
        message:
          "Payment succeeded, but Hotelbeds confirmation could not be proven. SafariPlug will not retry automatically because a duplicate transfer booking could result.",
      });
    }
  } catch (error) {
    const verification = travelerVerificationErrorResponse(error);
    if (verification) return NextResponse.json(verification.body, { status: verification.status });
    return errorResponse(
      500,
      error instanceof Error ? error.message : "Hotelbeds Transfers checkout failed."
    );
  }
}
