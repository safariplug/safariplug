import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "@/lib/payments/registry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    }

    const body = await request.json();
    const orderId = String(body.orderId || "");
    const phone = String(body.phone || "").trim();
    const provider = "mpesa" as const;
    const idempotencyKey = String(body.idempotencyKey || "").trim();

    if (!orderId || !idempotencyKey) {
      return NextResponse.json({ error: "orderId and idempotencyKey are required." }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("food_orders")
      .select("id,customer_user_id,customer_phone,customer_email,customer_total,currency,payment_status,payment_reference")
      .eq("id", orderId)
      .eq("customer_user_id", user.id)
      .maybeSingle();

    if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid." }, { status: 409 });

    const { data: existing } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("payment_intent_id,provider_reference,order_id")
      .eq("customer_user_id", user.id)
      .eq("provider", provider)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.payment_intent_id) {
      if (existing.order_id !== orderId) {
        return NextResponse.json({ error: "Idempotency key is already used for another order." }, { status: 409 });
      }
      return NextResponse.json({
        intent: {
          id: existing.payment_intent_id,
          provider,
          providerReference: existing.provider_reference,
          orderId,
          amount: Number(order.customer_total),
          currency: String(order.currency).toUpperCase(),
          status: "processing",
        },
      });
    }

    const adapter = getPaymentAdapter(provider);
    if (!adapter) {
      return NextResponse.json({ error: "payment_provider_not_configured:mpesa" }, { status: 503 });
    }

    const intent = await adapter.createPaymentIntent({
      appointmentId: order.id,
      amount: Number(order.customer_total),
      currency: String(order.currency).toUpperCase(),
      customerEmail: order.customer_email,
      customerPhone: phone || order.customer_phone,
      returnUrl: null,
      idempotencyKey,
      callbackUrl: null,
    });

    const { error: idemError } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .insert({
        order_id: order.id,
        customer_user_id: user.id,
        provider,
        idempotency_key: idempotencyKey,
        payment_intent_id: intent.id,
        provider_reference: intent.providerReference,
      });

    if (idemError && !idemError.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "Unable to persist payment record." }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("food_orders")
      .update({ payment_status: "processing", payment_reference: intent.providerReference })
      .eq("id", order.id)
      .eq("customer_user_id", user.id);

    if (updateError) return NextResponse.json({ error: "Unable to update order payment status." }, { status: 500 });

    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start M-Pesa payment.";
    const status = message.includes("not_configured") ? 503 : message.includes("already_paid") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
