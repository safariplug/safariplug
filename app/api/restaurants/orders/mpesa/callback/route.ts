import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CallbackItem = { Name?: unknown; Value?: unknown };

function callbackValue(items: CallbackItem[], name: string) {
  return items.find((item) => item?.Name === name)?.Value;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "").trim();
    const resultCode = Number(callback?.ResultCode ?? -1);
    if (!checkoutRequestId || !Number.isFinite(resultCode)) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid callback payload" }, { status: 400 });
    }

    const metadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item as CallbackItem[] : [];
    const receiptValue = callbackValue(metadata, "MpesaReceiptNumber");
    const amountValue = callbackValue(metadata, "Amount");
    const receipt = receiptValue == null ? null : String(receiptValue).trim();
    const callbackAmount = amountValue == null ? null : Number(amountValue);
    const paymentStatus = resultCode === 0 ? "paid" : "failed";
    const paymentReference = receipt || checkoutRequestId;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("order_id")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();
    if (paymentError) throw paymentError;

    // Unknown callbacks are acknowledged so the provider does not retry forever,
    // but they must never mutate an order.
    if (!payment?.order_id) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("food_orders")
      .select("id,customer_total,currency,payment_status,payment_intent_id,status")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    // SafariPlug restaurant payments currently use M-Pesa/KES. If the provider
    // supplies an amount, require it to match the authoritative order total.
    if (callbackAmount != null && (!Number.isFinite(callbackAmount) || Math.round(callbackAmount) !== Math.round(Number(order.customer_total)))) {
      console.error("Restaurant M-Pesa callback amount mismatch", {
        orderId: order.id,
        checkoutRequestId,
        callbackAmount,
        orderTotal: order.customer_total,
      });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    if (String(order.currency || "").toUpperCase() !== "KES") {
      console.error("Restaurant M-Pesa callback currency mismatch", { orderId: order.id, currency: order.currency });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // A terminal paid state can never be downgraded by a late/duplicate failure.
    if (order.payment_status === "paid") return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (!["unpaid", "pending", "processing", "failed"].includes(String(order.payment_status))) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { error: updateError } = await supabaseAdmin
      .from("food_orders")
      .update({
        payment_status: paymentStatus,
        payment_reference: paymentReference,
        payment_intent_id: order.payment_intent_id || checkoutRequestId,
      })
      .eq("id", order.id)
      .neq("payment_status", "paid");
    if (updateError) throw updateError;

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
