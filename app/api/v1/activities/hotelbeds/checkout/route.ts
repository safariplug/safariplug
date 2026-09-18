import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  preconfirmHotelbedsActivity,
  reconfirmHotelbedsActivity,
  getHotelbedsActivityBooking,
  cancelHotelbedsActivityBooking,
} from "@/lib/integrations/hotelbeds/activities";
import {
  activityBookingReference,
  activityBookingStatus,
  buildHotelbedsActivityBookingRequest,
  normalizeActivityAnswers,
  normalizeActivityHolder,
  normalizeActivityPaxes,
} from "@/lib/integrations/hotelbeds/activity-checkout";
import { openHotelbedsActivitySelectionToken } from "@/lib/integrations/hotelbeds/activity-selection-token";
import { convertCurrency } from "@/lib/currency/exchange-rates";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { assertTravelerVerified, travelerVerificationErrorResponse } from "@/lib/services/traveler-verification";
import { normalizeActivityCheckoutIntentKey, activityPreconfirmDefinitelyRejected, activityPaymentSafeToRetry } from "@/lib/integrations/hotelbeds/activity-payment-safety";
import { publicActivityCheckoutLedger } from "@/lib/integrations/hotelbeds/activity-public-ledger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MARKUP_PERCENT = 10;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: "hotelbeds_activities_checkout_error", message }, { status });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function markupPercent() {
  const parsed = Number(
    process.env.SAFARIPLUG_ACTIVITY_HOTELBEDS_MARKUP_PERCENT ||
      process.env.SAFARIPLUG_ACTIVITY_MARKUP_PERCENT ||
      DEFAULT_MARKUP_PERCENT
  );
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MARKUP_PERCENT;
}

function retailSupplierAmount(amount: number, percent: number) {
  return Math.round(amount * (1 + percent / 100) * 100) / 100;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return errorResponse(401, "Authentication required.");

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  const action = String(body.action || "").trim().toLowerCase();
  const supabase = await createSupabaseServerClient();

  try {
    if (action === "preflight") {
      const selectionToken = String(body.selectionToken || "");
      if (!selectionToken) return errorResponse(400, "selectionToken is required.");
      const selection = openHotelbedsActivitySelectionToken(selectionToken);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") {
        return errorResponse(400, "Hotelbeds Activities M-Pesa checkout currently supports KES only.");
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
        product: "activities",
        status: "preflight_ready",
        selectionToken,
        bookingCreated: false,
        supplierHoldCreated: false,
        paymentCharged: false,
        pricing: {
          supplierAmount: selection.supplierAmount,
          supplierCurrency: selection.supplierCurrency,
          customerRetailAmount: converted.amount,
          customerCurrency,
          exchangeRate: converted.rate,
          markupPercent: percent,
        },
        activity: {
          code: selection.activityCode,
          name: selection.activityName,
          modalityCode: selection.modalityCode,
          modalityName: selection.modalityName,
          from: selection.from,
          to: selection.to,
          sessionCode: selection.sessionCode || null,
          sessionName: selection.sessionName || null,
          languageCode: selection.languageCode || null,
          languageName: selection.languageName || null,
          rateClass: selection.rateClass || null,
          freeCancellation: selection.freeCancellation ?? null,
          cancellationPolicies: selection.cancellationPolicies || [],
          comments: selection.comments || [],
          questions: selection.questions || [],
          paxes: selection.paxes,
        },
        termsRequired: true,
      });
    }

    if (action === "prepare") {
      await assertTravelerVerified(user.id);
      const selectionToken = String(body.selectionToken || "");
      if (!selectionToken) return errorResponse(400, "selectionToken is required.");
      const intentKey = normalizeActivityCheckoutIntentKey(body.idempotencyKey);
      if (body.termsAccepted !== true) {
        return errorResponse(400, "Accept the activity rate and cancellation terms before continuing.");
      }

      const mpesa = getPaymentAdapter("mpesa");
      if (!mpesa) return errorResponse(503, "M-Pesa is not configured yet.");

      const { data: existingIntent, error: existingIntentError } = await supabase
        .from("activity_booking_pricing_ledger")
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
          product: "activities",
          status:
            existingIntent.booking_status === "confirmed"
              ? "confirmed"
              : existingIntent.payment_reference
                ? "payment_pending"
                : existingMetadata.preconfirmAttemptIndeterminateAt
                  ? "preconfirmation_indeterminate"
                  : existingIntent.booking_status === "preconfirmed"
                    ? "payment_initializing"
                    : "preconfirm_initializing",
          bookingId: existingIntent.prepared_booking_id,
          bookingCreated: existingIntent.booking_status === "confirmed",
          supplierHoldCreated: Boolean(existingIntent.provider_booking_reference),
          paymentReused: true,
          supplierStatus: existingMetadata.preconfirmAttemptIndeterminateAt
            ? "preconfirmation_indeterminate"
            : "existing_checkout_intent",
          reconciliation: existingMetadata.preconfirmAttemptIndeterminateAt
            ? "manual_required"
            : undefined,
        });
      }

      const selection = openHotelbedsActivitySelectionToken(selectionToken);
      const holder = normalizeActivityHolder(body.holder);
      const paxes = normalizeActivityPaxes(selection.paxes, body.paxes);
      const answers = normalizeActivityAnswers(selection.questions, body.answers);
      const customerCurrency = String(body.currency || "KES").toUpperCase();
      if (customerCurrency !== "KES") {
        return errorResponse(400, "Hotelbeds Activities M-Pesa checkout currently supports KES only.");
      }

      const phone = String(body.customerPhone || holder.telephones[0] || "").trim();
      if (!phone) return errorResponse(400, "A customer M-Pesa phone number is required.");

      const percent = markupPercent();
      const supplierRetail = retailSupplierAmount(selection.supplierAmount, percent);
      const converted = await convertCurrency(
        supplierRetail,
        selection.supplierCurrency,
        customerCurrency
      );

      const preparedBookingId = `hotelbeds-activity-${randomUUID()}`;
      const clientReference = `SPA-${preparedBookingId.slice(-16)}`;
      const bookingRequest = buildHotelbedsActivityBookingRequest({
        selection,
        holder,
        paxes,
        answers,
        clientReference,
        responseLanguage: "en",
      });

      const { data: ledger, error: ledgerError } = await supabase
        .from("activity_booking_pricing_ledger")
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
          booking_status: "preconfirm_pending",
          supplier_settlement_status: "pending",
          metadata: {
            selectionToken,
            holder,
            paxes,
            answers,
            bookingRequest,
            clientReference,
            termsAcceptedAt: new Date().toISOString(),
            activity: {
              code: selection.activityCode,
              name: selection.activityName,
              modalityCode: selection.modalityCode,
              modalityName: selection.modalityName,
              from: selection.from,
              to: selection.to,
              sessionCode: selection.sessionCode || null,
              sessionName: selection.sessionName || null,
              languageCode: selection.languageCode || null,
              languageName: selection.languageName || null,
            },
            cancellationPolicies: selection.cancellationPolicies || [],
          },
        })
        .select("*")
        .single();

      if (ledgerError || !ledger) {
        if (ledgerError?.code === "23505") {
          const { data: racedIntent, error: racedIntentError } = await supabase
            .from("activity_booking_pricing_ledger")
            .select("*")
            .eq("customer_user_id", user.id)
            .eq("provider", "hotelbeds")
            .eq("checkout_intent_key", intentKey)
            .maybeSingle();
          if (racedIntentError) throw new Error(racedIntentError.message);
          if (racedIntent) {
            return NextResponse.json({
              provider: "hotelbeds",
              product: "activities",
              status: "preconfirm_initializing",
              bookingId: racedIntent.prepared_booking_id,
              bookingCreated: false,
              supplierHoldCreated: Boolean(racedIntent.provider_booking_reference),
              paymentReused: true,
              supplierStatus: "existing_checkout_intent",
            });
          }
        }
        throw new Error(ledgerError?.message || "Unable to create activity checkout ledger entry.");
      }

      const preconfirmStartedAt = new Date().toISOString();
      const { data: claimedLedger, error: claimError } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          preconfirm_initiation_started_at: preconfirmStartedAt,
          metadata: {
            ...metadataRecord(ledger.metadata),
            preconfirmInitiationStartedAt: preconfirmStartedAt,
          },
        })
        .eq("id", ledger.id)
        .eq("customer_user_id", user.id)
        .eq("booking_status", "preconfirm_pending")
        .is("preconfirm_initiation_started_at", null)
        .select("*")
        .maybeSingle();

      if (claimError) throw new Error(claimError.message);
      if (!claimedLedger) {
        return NextResponse.json({
          provider: "hotelbeds",
          product: "activities",
          status: "preconfirm_initializing",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierHoldCreated: false,
          paymentReused: true,
          supplierStatus: "existing_preconfirm_initiation",
        });
      }

      let preconfirmed: Record<string, unknown>;
      try {
        preconfirmed = await preconfirmHotelbedsActivity(bookingRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Hotelbeds activity preconfirmation failed.";
        if (activityPreconfirmDefinitelyRejected(error)) {
          await supabase
            .from("activity_booking_pricing_ledger")
            .update({
              booking_status: "failed",
              supplier_settlement_status: "failed",
              metadata: {
                ...metadataRecord(claimedLedger.metadata),
                preconfirmFailedAt: new Date().toISOString(),
                preconfirmError: message,
              },
            })
            .eq("id", ledger.id);
          throw error;
        }

        await supabase
          .from("activity_booking_pricing_ledger")
          .update({
            metadata: {
              ...metadataRecord(claimedLedger.metadata),
              preconfirmAttemptIndeterminateAt: new Date().toISOString(),
              preconfirmError: message,
            },
          })
          .eq("id", ledger.id);

        return NextResponse.json({
          provider: "hotelbeds",
          product: "activities",
          status: "preconfirmation_indeterminate",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierHoldCreated: false,
          supplierStatus: "preconfirmation_indeterminate",
          reconciliation: "manual_required",
          message:
            "SafariPlug could not prove whether Hotelbeds created the PRECONFIRMED hold. It will not submit another PRECONFIRM automatically because that could create duplicate supplier holds.",
        });
      }

      const supplierReference = activityBookingReference(preconfirmed);
      const supplierStatus = activityBookingStatus(preconfirmed);
      if (!supplierReference || supplierStatus !== "PRECONFIRMED") {
        await supabase
          .from("activity_booking_pricing_ledger")
          .update({
            metadata: {
              ...metadataRecord(claimedLedger.metadata),
              preconfirmResponse: preconfirmed,
              preconfirmAttemptIndeterminateAt: new Date().toISOString(),
            },
          })
          .eq("id", ledger.id);
        return NextResponse.json({
          provider: "hotelbeds",
          product: "activities",
          status: "preconfirmation_indeterminate",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierHoldCreated: false,
          supplierStatus: "preconfirmation_indeterminate",
          reconciliation: "manual_required",
          message:
            "Hotelbeds returned a preconfirmation response SafariPlug could not safely classify. No automatic retry will be made.",
        });
      }

      const preconfirmedAt = new Date().toISOString();
      const { data: heldLedger, error: holdUpdateError } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          provider_booking_reference: supplierReference,
          booking_status: "preconfirmed",
          preconfirmed_at: preconfirmedAt,
          metadata: {
            ...metadataRecord(claimedLedger.metadata),
            preconfirmResponse: preconfirmed,
            preconfirmedAt,
          },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();

      if (holdUpdateError || !heldLedger) {
        throw new Error(holdUpdateError?.message || "Unable to persist Hotelbeds preconfirmation.");
      }

      const paymentStartedAt = new Date().toISOString();
      const { data: paymentClaim, error: paymentClaimError } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          payment_status: "pending",
          payment_initiation_started_at: paymentStartedAt,
          metadata: {
            ...metadataRecord(heldLedger.metadata),
            paymentInitiationStartedAt: paymentStartedAt,
          },
        })
        .eq("id", ledger.id)
        .eq("customer_user_id", user.id)
        .eq("booking_status", "preconfirmed")
        .eq("payment_status", "unpaid")
        .is("payment_reference", null)
        .is("payment_initiation_started_at", null)
        .select("*")
        .maybeSingle();

      if (paymentClaimError) throw new Error(paymentClaimError.message);
      if (!paymentClaim) {
        return NextResponse.json({
          provider: "hotelbeds",
          product: "activities",
          status: "payment_initializing",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierHoldCreated: true,
          supplierStatus: "PRECONFIRMED",
          paymentReused: true,
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
          returnUrl: `${SITE_URL}/activities/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(preparedBookingId)}`,
          idempotencyKey: `hotelbeds-activity:${intentKey}`,
          callbackUrl: `${SITE_URL}/api/v1/activities/hotelbeds/mpesa/callback`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "M-Pesa payment initiation failed.";
        if (activityPaymentSafeToRetry(error)) {
          await supabase
            .from("activity_booking_pricing_ledger")
            .update({
              payment_status: "unpaid",
              payment_initiation_started_at: null,
              metadata: {
                ...metadataRecord(paymentClaim.metadata),
                paymentInitiationSafeFailureAt: new Date().toISOString(),
                paymentInitiationError: message,
              },
            })
            .eq("id", ledger.id);
          throw error;
        }

        await supabase
          .from("activity_booking_pricing_ledger")
          .update({
            payment_status: "pending",
            metadata: {
              ...metadataRecord(paymentClaim.metadata),
              paymentInitiationIndeterminateAt: new Date().toISOString(),
              paymentInitiationError: message,
            },
          })
          .eq("id", ledger.id);

        return NextResponse.json({
          provider: "hotelbeds",
          product: "activities",
          status: "payment_initiation_indeterminate",
          bookingId: preparedBookingId,
          bookingCreated: false,
          supplierHoldCreated: true,
          supplierStatus: "PRECONFIRMED",
          reconciliation: "manual_required",
          message:
            "SafariPlug could not prove whether the M-Pesa request was created. It will not submit another payment request automatically because that could cause a duplicate charge.",
        });
      }

      const { data: updated } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          payment_provider: "mpesa",
          payment_reference: payment.providerReference,
          payment_status: "pending",
          booking_status: "payment_pending",
          metadata: {
            ...metadataRecord(paymentClaim.metadata),
            mpesaPaymentId: payment.id,
          },
        })
        .eq("id", ledger.id)
        .select("*")
        .single();

      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: "payment_pending",
        bookingId: preparedBookingId,
        bookingCreated: false,
        supplierHoldCreated: true,
        supplierStatus: "PRECONFIRMED",
        pricing: {
          supplierAmount: selection.supplierAmount,
          supplierCurrency: selection.supplierCurrency,
          customerRetailAmount: converted.amount,
          customerCurrency,
          exchangeRate: converted.rate,
          markupPercent: percent,
        },
        payment,
        ledger: publicActivityCheckoutLedger(updated || paymentClaim),
      });
    }

    const bookingId = String(body.bookingId || body.preparedBookingId || "");
    if (!bookingId) return errorResponse(400, "bookingId is required.");

    const { data: ledger, error: ledgerError } = await supabase
      .from("activity_booking_pricing_ledger")
      .select("*")
      .eq("customer_user_id", user.id)
      .eq("provider", "hotelbeds")
      .eq("prepared_booking_id", bookingId)
      .maybeSingle();

    if (ledgerError) throw new Error(ledgerError.message);
    if (!ledger) return errorResponse(404, "Hotelbeds activity checkout not found.");

    const metadata = metadataRecord(ledger.metadata);

    if (action === "detail") {
      if (!ledger.provider_booking_reference) {
        return errorResponse(409, "Supplier booking reference is not available.");
      }
      const providerBooking = await getHotelbedsActivityBooking(
        ledger.provider_booking_reference,
        "en"
      );
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: ledger.booking_status,
        providerBooking,
      });
    }

    if (action === "cancel_preview") {
      if (ledger.booking_status !== "confirmed" || !ledger.provider_booking_reference) {
        return errorResponse(409, "Only confirmed activity bookings can be cancelled.");
      }
      const preview = await cancelHotelbedsActivityBooking(
        ledger.provider_booking_reference,
        "SIMULATION",
        "en"
      );
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
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
        return errorResponse(409, "Only confirmed activity bookings can be cancelled.");
      }

      const preview = await cancelHotelbedsActivityBooking(
        ledger.provider_booking_reference,
        "SIMULATION",
        "en"
      );
      const cancelled = await cancelHotelbedsActivityBooking(
        ledger.provider_booking_reference,
        "CANCELLATION",
        "en"
      );
      const { data: updated } = await supabase
        .from("activity_booking_pricing_ledger")
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
        product: "activities",
        status: "cancelled",
        preview,
        providerBooking: cancelled,
        ledger: publicActivityCheckoutLedger(updated || ledger),
        refund:
          "Supplier cancellation does not automatically issue an M-Pesa refund. Any customer refund due is handled separately.",
      });
    }

    if (action !== "status") {
      return errorResponse(400, "Unsupported Hotelbeds Activities checkout action.");
    }

    let workingLedger = ledger;
    if (
      workingLedger.payment_provider === "mpesa" &&
      workingLedger.payment_reference &&
      workingLedger.payment_status !== "paid"
    ) {
      const mpesa = getPaymentAdapter("mpesa");
      if (mpesa) {
        const paymentStatus = await mpesa.getPaymentStatus(workingLedger.payment_reference);
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
        if (paymentStatus === "failed") {
          update.booking_status = "failed";
          update.supplier_settlement_status = "failed";
        }

        const { data: refreshed } = await supabase
          .from("activity_booking_pricing_ledger")
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
        product: "activities",
        status: "failed",
        bookingCreated: false,
        supplierStatus: "PRECONFIRMED_NOT_RECONFIRMED",
        ledger: publicActivityCheckoutLedger(workingLedger),
        message: "M-Pesa payment failed; the Hotelbeds activity was not reconfirmed.",
      });
    }

    if (workingLedger.payment_status !== "paid") {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "PRECONFIRMED",
        ledger: publicActivityCheckoutLedger(workingLedger),
      });
    }

    if (workingLedger.booking_status === "confirmed") {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: "confirmed",
        bookingCreated: true,
        ledger: publicActivityCheckoutLedger(workingLedger),
        providerBooking: metadataRecord(workingLedger.metadata).providerBooking || null,
      });
    }

    const currentMetadata = metadataRecord(workingLedger.metadata);
    if (currentMetadata.reconfirmAttemptIndeterminateAt) {
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "reconfirmation_indeterminate",
        reconciliation: "manual_required",
        ledger: publicActivityCheckoutLedger(workingLedger),
        message:
          "Payment succeeded, but Hotelbeds activity reconfirmation could not be proven. SafariPlug will not retry blindly.",
      });
    }

    const reference = String(workingLedger.provider_booking_reference || "");
    if (!reference) {
      return errorResponse(409, "Preconfirmed Hotelbeds booking reference is missing.");
    }

    try {
      const providerBooking = await reconfirmHotelbedsActivity(reference, "en");
      const returnedReference = activityBookingReference(providerBooking);
      const returnedStatus = activityBookingStatus(providerBooking);
      if (returnedReference !== reference || returnedStatus !== "CONFIRMED") {
        throw new Error("Hotelbeds did not return a confirmed activity booking.");
      }

      const confirmedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          booking_status: "confirmed",
          supplier_settlement_status: "settled",
          confirmed_at: confirmedAt,
          metadata: {
            ...currentMetadata,
            reconfirmAcceptedAt: confirmedAt,
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
        product: "activities",
        status: "confirmed",
        bookingCreated: true,
        bookingReference: reference,
        providerBooking,
        ledger: publicActivityCheckoutLedger(updated),
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const message =
        error instanceof Error
          ? error.message
          : "Hotelbeds activity reconfirmation returned an unknown result.";

      const { data: pending } = await supabase
        .from("activity_booking_pricing_ledger")
        .update({
          booking_status: "payment_pending",
          supplier_settlement_status: "pending",
          metadata: {
            ...currentMetadata,
            reconfirmAttemptIndeterminateAt: timestamp,
            reconfirmAttemptError: message,
          },
        })
        .eq("id", workingLedger.id)
        .eq("customer_user_id", user.id)
        .select("*")
        .single();

      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        status: "payment_pending",
        bookingCreated: false,
        supplierStatus: "reconfirmation_indeterminate",
        reconciliation: "manual_required",
        ledger: publicActivityCheckoutLedger(pending || workingLedger),
        message:
          "Payment succeeded, but Hotelbeds activity reconfirmation could not be proven. SafariPlug will not retry automatically.",
      });
    }
  } catch (error) {
    const verification = travelerVerificationErrorResponse(error);
    if (verification) return NextResponse.json(verification.body, { status: verification.status });
    return errorResponse(
      500,
      error instanceof Error ? error.message : "Hotelbeds Activities checkout failed."
    );
  }
}
