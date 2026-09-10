import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reverseMpesaTransaction } from "@/lib/payments/mpesa-reversal";

export const dynamic = "force-dynamic";
async function user() { const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); return user && !user.is_anonymous ? user : null; }
async function supplierBusinessId(userId: string) { const { data } = await supabaseAdmin.from("supplier_accounts").select("business_id").eq("user_id", userId).maybeSingle(); return data?.business_id ?? null; }
export async function POST(request: Request) {
  const currentUser = await user(); if (!currentUser) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json(); const orderId = String(body?.orderId || "").trim(); const idempotencyKey = String(body?.idempotencyKey || "").trim();
  if (!orderId || !idempotencyKey) return NextResponse.json({ error: "orderId and idempotencyKey are required" }, { status: 400 });
  if (idempotencyKey.length > 200) return NextResponse.json({ error: "idempotencyKey is too long" }, { status: 400 });
  const businessId = await supplierBusinessId(currentUser.id); if (!businessId) return NextResponse.json({ error: "Supplier access denied" }, { status: 403 });
  const { data: order, error: orderError } = await supabaseAdmin.from("food_orders").select("id,business_id,payment_status,payment_reference,refund_reference,customer_total,currency,refunded_amount").eq("id", orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order || order.business_id !== businessId) return NextResponse.json({ error: "Order access denied" }, { status: 403 });
  if (order.payment_status === "refunded") return NextResponse.json({ refund: { status: "succeeded", amount: order.refunded_amount, reference: order.refund_reference ?? order.payment_reference } });
  if (order.payment_status !== "paid") return NextResponse.json({ error: "Only paid restaurant orders can be refunded" }, { status: 409 });
  if (String(order.currency).toUpperCase() !== "KES") return NextResponse.json({ error: "M-Pesa refunds require KES orders" }, { status: 409 });
  if (!order.payment_reference) return NextResponse.json({ error: "No M-Pesa transaction reference is available for this order" }, { status: 409 });
  const { data: existingByKey } = await supabaseAdmin.from("food_order_refunds").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingByKey) return NextResponse.json({ refund: existingByKey }, { status: existingByKey.status === "failed" ? 409 : 200 });
  const { data: active } = await supabaseAdmin.from("food_order_refunds").select("*").eq("order_id", orderId).in("status", ["pending", "processing"]).maybeSingle();
  if (active) return NextResponse.json({ refund: active }, { status: 409 });
  const amount = Number(order.customer_total);
  const { data: refund, error: insertError } = await supabaseAdmin.from("food_order_refunds").insert({ order_id: orderId, provider: "mpesa", amount, currency: "KES", idempotency_key: idempotencyKey, status: "processing", requested_by: currentUser.id }).select().single();
  if (insertError) { if (insertError.code === "23505") return NextResponse.json({ error: "A refund request already exists for this order" }, { status: 409 }); return NextResponse.json({ error: insertError.message }, { status: 400 }); }
  try {
    const reversal = await reverseMpesaTransaction({ transactionId: String(order.payment_reference), amount, remarks: `SafariPlug refund ${orderId.slice(0, 12)}`, occasion: "Restaurant order refund" });
    if (!reversal.accepted) { await supabaseAdmin.from("food_order_refunds").update({ status: "failed", error_message: reversal.responseDescription || "M-Pesa rejected the reversal", updated_at: new Date().toISOString(), processed_at: new Date().toISOString() }).eq("id", refund.id); return NextResponse.json({ error: reversal.responseDescription || "M-Pesa rejected the refund" }, { status: 502 }); }
    const now = new Date().toISOString();
    const { data: updatedRefund, error: updateError } = await supabaseAdmin.from("food_order_refunds").update({ provider_reference: reversal.originatorConversationId, refund_reference: reversal.conversationId, updated_at: now }).eq("id", refund.id).select().single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ refund: updatedRefund }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund provider error";
    await supabaseAdmin.from("food_order_refunds").update({ status: "failed", error_message: message.slice(0, 1000), updated_at: new Date().toISOString(), processed_at: new Date().toISOString() }).eq("id", refund.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
