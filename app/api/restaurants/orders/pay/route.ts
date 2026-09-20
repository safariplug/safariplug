import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter, getConfiguredPaymentProviders } from "@/lib/payments/registry";

export const dynamic = "force-dynamic";

const CLAIM_MS = 10 * 60 * 1000;

function isMpesaSubmissionUncertain(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message === "mpesa_submission_uncertain" || message === "mpesa_stk_response_uncertain";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const orderId = String(body?.orderId || "").trim();
    const phone = String(body?.phone || "").trim();
    const idempotencyKey = String(body?.idempotencyKey || "").trim();
    const provider = "mpesa" as const;
    if (!orderId || !idempotencyKey) return NextResponse.json({ error: "orderId and idempotencyKey are required." }, { status: 400 });
    if (idempotencyKey.length > 200) return NextResponse.json({ error: "idempotencyKey is too long" }, { status: 400 });
    if (!getConfiguredPaymentProviders().includes(provider)) return NextResponse.json({ error: "payment_provider_not_configured:mpesa" }, { status: 503 });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("food_orders")
      .select("id,customer_user_id,customer_phone,customer_email,customer_total,currency,payment_status,payment_reference,status")
      .eq("id", orderId)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (orderError) {
      console.error("Restaurant payment order lookup failed", orderError);
      return NextResponse.json({ error: "Payment preflight failed.", retryAllowed: false }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (["cancelled", "rejected", "delivered"].includes(order.status)) return NextResponse.json({ error: "This order can no longer accept payment." }, { status: 409 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid." }, { status: 409 });

    const amount = Number(order.customer_total);
    const currency = String(order.currency || "").trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return NextResponse.json({ error: "Order total is invalid for payment." }, { status: 409 });
    if (currency !== "KES") return NextResponse.json({ error: "M-Pesa restaurant payments require KES." }, { status: 409 });

    let claimId: string | null = null;
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("id,payment_intent_id,provider_reference,order_id,processing_until,provider_submission_state,attempt_active")
      .eq("customer_user_id", user.id)
      .eq("provider", provider)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingError) {
      console.error("Restaurant payment idempotency preflight failed", existingError);
      return NextResponse.json({ error: "Payment preflight failed.", retryAllowed: false }, { status: 500 });
    }
    if (existing?.order_id && existing.order_id !== orderId) {
      return NextResponse.json({ error: "Idempotency key is already used for another order.", retryAllowed: false }, { status: 409 });
    }
    if (existing?.payment_intent_id) {
      if (order.payment_status === "failed") {
        return NextResponse.json({ error: "The previous payment attempt failed. Start a new payment attempt with a new idempotency key.", retryAllowed: true }, { status: 409 });
      }
      return NextResponse.json({
        intent: {
          id: existing.payment_intent_id,
          provider,
          providerReference: existing.provider_reference,
          orderId,
          amount,
          currency,
          status: "processing",
        },
      });
    }
    if (existing?.provider_submission_state === "uncertain" || existing?.provider_submission_state === "submitted") {
      return NextResponse.json({
        error: "Payment submission requires reconciliation before any retry.",
        retryAllowed: false,
      }, { status: 409 });
    }

    const { data: activeAttempt, error: activeError } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("id,idempotency_key,payment_intent_id,provider_reference,provider_submission_state")
      .eq("order_id", order.id)
      .eq("customer_user_id", user.id)
      .eq("provider", provider)
      .eq("attempt_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) {
      console.error("Restaurant payment active-attempt preflight failed", activeError);
      return NextResponse.json({ error: "Payment preflight failed.", retryAllowed: false }, { status: 500 });
    }
    if (activeAttempt && activeAttempt.id !== existing?.id) {
      if (activeAttempt.payment_intent_id) {
        return NextResponse.json({
          intent: {
            id: activeAttempt.payment_intent_id,
            provider,
            providerReference: activeAttempt.provider_reference,
            orderId,
            amount,
            currency,
            status: "processing",
          },
          warning: "An existing M-Pesa payment attempt is still active for this order.",
          retryAllowed: false,
        });
      }
      return NextResponse.json({
        error: activeAttempt.provider_submission_state === "uncertain"
          ? "An earlier M-Pesa submission is uncertain and requires reconciliation."
          : "Payment request is already in progress. Please wait and check payment status.",
        retryAllowed: false,
      }, { status: 409 });
    }

    const claimUntil = new Date(Date.now() + CLAIM_MS).toISOString();
    if (existing?.id) {
      if (existing.processing_until && new Date(existing.processing_until).getTime() > Date.now()) {
        return NextResponse.json({ error: "Payment request is already in progress. Please wait and check payment status.", retryAllowed: false }, { status: 409 });
      }
      const { data: reclaimed, error: reclaimError } = await supabaseAdmin
        .from("food_order_payment_idempotency")
        .update({
          processing_until: claimUntil,
          provider_submission_state: "submitted",
          attempt_active: true,
        })
        .eq("id", existing.id)
        .is("payment_intent_id", null)
        .eq("provider_submission_state", "ready")
        .eq("attempt_active", false)
        .or(`processing_until.is.null,processing_until.lte.${new Date().toISOString()}`)
        .select("id")
        .maybeSingle();
      if (reclaimError) {
        if (reclaimError.code === "23505") return NextResponse.json({ error: "Another payment attempt is already active for this order.", retryAllowed: false }, { status: 409 });
        throw reclaimError;
      }
      if (!reclaimed) return NextResponse.json({ error: "Payment request is already in progress. Please wait and check payment status.", retryAllowed: false }, { status: 409 });
      claimId = reclaimed.id;
    } else {
      const { data: createdClaim, error: claimError } = await supabaseAdmin
        .from("food_order_payment_idempotency")
        .insert({
          order_id: order.id,
          customer_user_id: user.id,
          provider,
          idempotency_key: idempotencyKey,
          processing_until: claimUntil,
          provider_submission_state: "submitted",
          attempt_active: true,
        })
        .select("id")
        .maybeSingle();
      if (claimError) {
        if (claimError.code === "23505" || claimError.message.toLowerCase().includes("duplicate")) {
          return NextResponse.json({ error: "Another payment attempt is already active for this order.", retryAllowed: false }, { status: 409 });
        }
        throw claimError;
      }
      claimId = createdClaim?.id ?? null;
    }
    if (!claimId) throw new Error("Unable to reserve payment request.");

    const adapter = getPaymentAdapter(provider);
    if (!adapter) {
      await supabaseAdmin.from("food_order_payment_idempotency")
        .update({ processing_until: null, provider_submission_state: "ready", attempt_active: false })
        .eq("id", claimId).is("payment_intent_id", null);
      return NextResponse.json({ error: "payment_provider_not_configured:mpesa" }, { status: 503 });
    }

    let intent;
    try {
      intent = await adapter.createPaymentIntent({
        appointmentId: order.id,
        amount,
        currency,
        customerEmail: order.customer_email,
        customerPhone: phone || order.customer_phone,
        returnUrl: null,
        idempotencyKey,
        callbackUrl: null,
      });
    } catch (error) {
      const uncertain = isMpesaSubmissionUncertain(error);
      const { error: releaseError } = await supabaseAdmin.from("food_order_payment_idempotency")
        .update({
          processing_until: null,
          provider_submission_state: uncertain ? "uncertain" : "ready",
          attempt_active: uncertain,
        })
        .eq("id", claimId)
        .is("payment_intent_id", null);
      if (releaseError) console.error("Failed to persist restaurant payment submission state", releaseError);

      if (uncertain) {
        return NextResponse.json({
          error: "M-Pesa payment submission outcome is uncertain. Reconciliation is required before any retry.",
          retryAllowed: false,
        }, { status: 202 });
      }
      throw error;
    }

    const { data: persistedIntent, error: intentError } = await supabaseAdmin.from("food_order_payment_idempotency")
      .update({
        payment_intent_id: intent.id,
        provider_reference: intent.providerReference,
        processing_until: null,
        provider_submission_state: "ready",
        attempt_active: true,
      })
      .eq("id", claimId)
      .is("payment_intent_id", null)
      .select("id")
      .maybeSingle();

    if (intentError || !persistedIntent) {
      const { error: recoveryError } = await supabaseAdmin.from("food_order_payment_idempotency")
        .update({
          payment_intent_id: intent.id,
          provider_reference: intent.providerReference,
          processing_until: null,
          provider_submission_state: "uncertain",
          attempt_active: true,
        })
        .eq("id", claimId)
        .is("payment_intent_id", null);
      if (recoveryError) console.error("Restaurant payment intent persistence recovery failed", recoveryError);
      return NextResponse.json({
        intent: { ...intent, status: "processing" },
        warning: "M-Pesa accepted the payment request but SafariPlug could not fully persist its correlation state. Do not retry; reconciliation is required.",
        retryAllowed: false,
      }, { status: 202 });
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin.from("food_orders")
      .update({ payment_status: "pending", payment_reference: intent.providerReference, payment_intent_id: intent.id })
      .eq("id", order.id)
      .eq("customer_user_id", user.id)
      .in("status", ["pending", "accepted", "preparing", "ready", "driver_assigned", "picked_up", "on_the_way"])
      .neq("payment_status", "paid")
      .select("id")
      .maybeSingle();

    if (updateError || !updatedOrder) {
      console.error("Restaurant order payment state persistence failed after M-Pesa acceptance", updateError);
      return NextResponse.json({
        intent: { ...intent, status: "processing" },
        warning: "M-Pesa accepted the payment request but the order state could not be secured. Do not retry; reconciliation is required.",
        retryAllowed: false,
      }, { status: 202 });
    }

    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start M-Pesa payment.";
    return NextResponse.json({ error: message }, { status: message.includes("not_configured") ? 503 : 400 });
  }
}
