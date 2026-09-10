import { supabaseAdmin } from "@/lib/supabase-admin";
import { reverseMpesaTransaction } from "@/lib/payments/mpesa-reversal";

export async function initiateRestaurantRefund(input: { orderId: string; requestedBy: string; idempotencyKey: string }) {
  const { orderId, requestedBy, idempotencyKey } = input;
  const { data: order, error: orderError } = await supabaseAdmin
    .from("food_orders")
    .select("id,business_id,payment_status,payment_reference,customer_total,currency,refunded_amount")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("restaurant_order_not_found");
  if (order.payment_status === "refunded") return { status: "succeeded" as const, order, refund: null };
  if (order.payment_status !== "paid") throw new Error("only_paid_restaurant_orders_can_be_refunded");
  if (String(order.currency).toUpperCase() !== "KES") throw new Error("mpesa_refunds_require_kes");
  if (!order.payment_reference) throw new Error("mpesa_transaction_reference_missing");

  const { data: existingByKey } = await supabaseAdmin
    .from("food_order_refunds")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingByKey) return { status: existingByKey.status === "succeeded" ? "succeeded" as const : "processing" as const, order, refund: existingByKey };

  const { data: active } = await supabaseAdmin
    .from("food_order_refunds")
    .select("*")
    .eq("order_id", orderId)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (active) return { status: "processing" as const, order, refund: active };

  const amount = Number(order.customer_total);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_refund_amount");

  const { data: refund, error: insertError } = await supabaseAdmin
    .from("food_order_refunds")
    .insert({ order_id: orderId, provider: "mpesa", amount, currency: "KES", idempotency_key: idempotencyKey, status: "processing", requested_by: requestedBy })
    .select()
    .single();
  if (insertError) {
    if (insertError.code === "23505") throw new Error("refund_request_already_exists");
    throw insertError;
  }

  try {
    const reversal = await reverseMpesaTransaction({
      transactionId: String(order.payment_reference),
      amount,
      remarks: `SafariPlug refund ${orderId.slice(0, 12)}`,
      occasion: "Restaurant order refund",
    });
    const now = new Date().toISOString();
    if (!reversal.accepted) {
      await supabaseAdmin.from("food_order_refunds").update({ status: "failed", error_message: reversal.responseDescription || "M-Pesa rejected the reversal", updated_at: now, processed_at: now }).eq("id", refund.id);
      throw new Error(reversal.responseDescription || "mpesa_reversal_rejected");
    }
    const { data: updatedRefund, error: updateError } = await supabaseAdmin
      .from("food_order_refunds")
      .update({ provider_reference: reversal.originatorConversationId, refund_reference: reversal.conversationId, updated_at: now })
      .eq("id", refund.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return { status: "processing" as const, order, refund: updatedRefund };
  } catch (error) {
    const message = error instanceof Error ? error.message : "refund_provider_error";
    await supabaseAdmin.from("food_order_refunds").update({ status: "failed", error_message: message.slice(0, 1000), updated_at: new Date().toISOString(), processed_at: new Date().toISOString() }).eq("id", refund.id).eq("status", "processing");
    throw error;
  }
}
