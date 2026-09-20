import { supabaseAdmin } from "@/lib/supabase-admin";
import { isMpesaReversalSubmissionUncertain, reverseMpesaTransaction } from "@/lib/payments/mpesa-reversal";

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

  const { data: existingByKey, error: existingByKeyError } = await supabaseAdmin
    .from("food_order_refunds")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingByKeyError) throw existingByKeyError;
  if (existingByKey) return { status: existingByKey.status === "succeeded" ? "succeeded" as const : "processing" as const, order, refund: existingByKey };

  const { data: active, error: activeError } = await supabaseAdmin
    .from("food_order_refunds")
    .select("*")
    .eq("order_id", orderId)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (activeError) throw activeError;
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
    const { data: updatedRefund, error: updateError } = await supabaseAdmin
      .from("food_order_refunds")
      .update({ provider_reference: reversal.originatorConversationId, refund_reference: reversal.conversationId, updated_at: now })
      .eq("id", refund.id)
      .eq("status", "processing")
      .select()
      .maybeSingle();
    if (updateError || !updatedRefund) {
      const persistenceMessage = "M-Pesa reversal accepted; correlation persistence failed; reconciliation required; do not retry automatically";
      const { error: markerError } = await supabaseAdmin
        .from("food_order_refunds")
        .update({ error_message: persistenceMessage, updated_at: now })
        .eq("id", refund.id)
        .eq("status", "processing");
      if (markerError) console.error("Failed to mark restaurant reversal correlation persistence uncertainty", markerError);
      console.error("Restaurant reversal correlation persistence failed after provider acceptance", updateError);
      return { status: "processing" as const, order, refund, reconciliationRequired: true as const };
    }
    return { status: "processing" as const, order, refund: updatedRefund };
  } catch (error) {
    const message = error instanceof Error ? error.message : "refund_provider_error";
    const now = new Date().toISOString();

    if (isMpesaReversalSubmissionUncertain(error)) {
      const { data: uncertainRefund, error: uncertainUpdateError } = await supabaseAdmin
        .from("food_order_refunds")
        .update({
          error_message: `${message}: reconciliation required; do not retry automatically`.slice(0, 1000),
          updated_at: now,
        })
        .eq("id", refund.id)
        .eq("status", "processing")
        .select()
        .maybeSingle();
      if (uncertainUpdateError) throw uncertainUpdateError;
      return { status: "processing" as const, order, refund: uncertainRefund || refund };
    }

    await supabaseAdmin
      .from("food_order_refunds")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
        updated_at: now,
        processed_at: now,
      })
      .eq("id", refund.id)
      .eq("status", "processing");
    throw error;
  }
}
