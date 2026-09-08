import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "@/lib/payments/registry";
import type { PaymentProvider } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await request.json();
    const orderId = String(body.orderId || "");
    const provider = String(body.provider || "mpesa") as PaymentProvider;
    const idempotencyKey = String(body.idempotencyKey || "");
    if (!orderId || provider !== "mpesa" || !idempotencyKey) return NextResponse.json({ error: "orderId and idempotencyKey are required" }, { status: 400 });
    const { data: order } = await supabaseAdmin.from("food_orders").select("id,public_id,customer_user_id,customer_phone,customer_email,customer_total,currency,payment_status,payment_reference,status").eq("id", orderId).maybeSingle();
    if (!order || order.customer_user_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid" }, { status: 409 });
    const { data: existing } = await supabaseAdmin.from("food_order_payment_idempotency").select("payment_intent_id,provider_reference").eq("customer_user_id", user.id).eq("provider", provider).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing?.payment_intent_id) return NextResponse.json({ intent: { id: existing.payment_intent_id, provider, providerReference: existing.provider_reference, orderId, amount: Number(order.customer_total), currency: order.currency, status: "processing" } });
    const adapter = getPaymentAdapter(provider);
    if (!adapter) return NextResponse.json({ error: "mpesa_not_configured" }, { status: 503 });
    const intent = await adapter.createPaymentIntent({ appointmentId: order.id, amount: Number(order.customer_total), currency: String(order.currency).toUpperCase(), customerEmail: order.customer_email, customerPhone: order.customer_phone, returnUrl: null, idempotencyKey });
    const { error: idemError } = await supabaseAdmin.from("food_order_payment_idempotency").insert({ order_id: order.id, customer_user_id: user.id, provider, idempotency_key: idempotencyKey, payment_intent_id: intent.id, provider_reference: intent.providerReference });
    if (idemError && !idemError.message.toLowerCase().includes("duplicate")) throw new Error("Unable to persist payment record");
    await supabaseAdmin.from("food_orders").update({ payment_status: intent.status === "succeeded" ? "paid" : "pending", payment_reference: intent.providerReference, payment_intent_id: intent.id }).eq("id", order.id);
    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start payment";
    return NextResponse.json({ error: message }, { status: message.includes("not_configured") ? 503 : 400 });
  }
}
