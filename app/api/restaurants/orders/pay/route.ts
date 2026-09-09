import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter, getConfiguredPaymentProviders } from "@/lib/payments/registry";

export const dynamic = "force-dynamic";

const CLAIM_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const orderId = String(body?.orderId || "");
    const phone = String(body?.phone || "").trim();
    const idempotencyKey = String(body?.idempotencyKey || "").trim();
    const provider = "mpesa" as const;
    if (!orderId || !idempotencyKey) return NextResponse.json({ error: "orderId and idempotencyKey are required." }, { status: 400 });
    if (idempotencyKey.length > 200) return NextResponse.json({ error: "idempotencyKey is too long" }, { status: 400 });
    if (!getConfiguredPaymentProviders().includes(provider)) return NextResponse.json({ error: "payment_provider_not_configured:mpesa" }, { status: 503 });

    const { data: order, error } = await supabaseAdmin
      .from("food_orders")
      .select("id,customer_user_id,customer_phone,customer_email,customer_total,currency,payment_status,payment_reference,status")
      .eq("id", orderId)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (["cancelled", "rejected", "delivered"].includes(order.status)) return NextResponse.json({ error: "This order can no longer accept payment." }, { status: 409 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid." }, { status: 409 });

    const amount = Number(order.customer_total);
    const currency = String(order.currency || "").trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return NextResponse.json({ error: "Order total is invalid for payment." }, { status: 409 });
    if (currency !== "KES") return NextResponse.json({ error: "M-Pesa restaurant payments require KES." }, { status: 409 });

    let claimId: string | null = null;
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("id,payment_intent_id,provider_reference,order_id,processing_until")
      .eq("customer_user_id", user.id)
      .eq("provider", provider)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.order_id && existing.order_id !== orderId) return NextResponse.json({ error: "Idempotency key is already used for another order." }, { status: 409 });
    if (existing?.payment_intent_id) {
      return NextResponse.json({ intent: { id: existing.payment_intent_id, provider, providerReference: existing.provider_reference, orderId, amount, currency, status: "processing" } });
    }

    const claimUntil = new Date(Date.now() + CLAIM_MS).toISOString();
    if (existing?.id) {
      if (existing.processing_until && new Date(existing.processing_until).getTime() > Date.now()) {
        return NextResponse.json({ error: "Payment request is already in progress. Please wait and check payment status." }, { status: 409 });
      }
      const { data: reclaimed, error: reclaimError } = await supabaseAdmin
        .from("food_order_payment_idempotency")
        .update({ processing_until: claimUntil })
        .eq("id", existing.id)
        .is("payment_intent_id", null)
        .or(`processing_until.is.null,processing_until.lte.${new Date().toISOString()}`)
        .select("id")
        .maybeSingle();
      if (reclaimError) throw reclaimError;
      if (!reclaimed) return NextResponse.json({ error: "Payment request is already in progress. Please wait and check payment status." }, { status: 409 });
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
        })
        .select("id")
        .maybeSingle();
      if (claimError) {
        if (claimError.code === "23505" || claimError.message.toLowerCase().includes("duplicate")) {
          return NextResponse.json({ error: "Payment request is already in progress. Please wait and check payment status." }, { status: 409 });
        }
        throw claimError;
      }
      claimId = createdClaim?.id ?? null;
    }
    if (!claimId) throw new Error("Unable to reserve payment request.");

    const adapter = getPaymentAdapter(provider);
    if (!adapter) {
      await supabaseAdmin.from("food_order_payment_idempotency").update({ processing_until: new Date().toISOString() }).eq("id", claimId).is("payment_intent_id", null);
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
      await supabaseAdmin.from("food_order_payment_idempotency").update({ processing_until: new Date().toISOString() }).eq("id", claimId).is("payment_intent_id", null);
      throw error;
    }

    const { error: intentError } = await supabaseAdmin.from("food_order_payment_idempotency")
      .update({ payment_intent_id: intent.id, provider_reference: intent.providerReference, processing_until: null })
      .eq("id", claimId)
      .is("payment_intent_id", null);
    if (intentError) throw intentError;

    const { data: updatedOrder, error: updateError } = await supabaseAdmin.from("food_orders")
      .update({ payment_status: "pending", payment_reference: intent.providerReference, payment_intent_id: intent.id })
      .eq("id", order.id)
      .eq("customer_user_id", user.id)
      .in("status", ["pending", "accepted", "preparing", "ready", "driver_assigned", "picked_up", "on_the_way"])
      .neq("payment_status", "paid")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedOrder) return NextResponse.json({ error: "Order changed before payment could be secured. Do not retry this payment request." }, { status: 409 });

    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start M-Pesa payment.";
    return NextResponse.json({ error: message }, { status: message.includes("not_configured") ? 503 : 400 });
  }
}
