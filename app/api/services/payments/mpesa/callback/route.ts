import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

type CallbackItem = { Name?: unknown; Value?: unknown };

function callbackValue(items: CallbackItem[], name: string) {
  return items.find((item) => item?.Name === name)?.Value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "").trim();
    if (!checkoutRequestId) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" }, { status: 400 });
    }

    const resultCode = Number(callback?.ResultCode);
    if (!Number.isFinite(resultCode)) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid ResultCode" }, { status: 400 });
    }
    const metadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item as CallbackItem[] : [];
    const receiptValue = callbackValue(metadata, "MpesaReceiptNumber");
    const amountValue = callbackValue(metadata, "Amount");
    const receipt = receiptValue == null ? null : String(receiptValue).trim();

    const { data: foodIdem } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("order_id")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    if (foodIdem?.order_id) {
      const { data: order } = await supabaseAdmin
        .from("food_orders")
        .select("id,customer_total,currency,payment_status,payment_intent_id,status")
        .eq("id", foodIdem.order_id)
        .maybeSingle();

      if (!order) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

      // A terminal paid state can never be downgraded by a late/duplicate failure.
      if (order.payment_status === "paid") {
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      // Successful restaurant callbacks must match the authoritative order total.
      // Failed callbacks do not contain payment metadata, so they are allowed through.
      if (resultCode === 0) {
        const callbackAmount = Number(amountValue);
        const expectedAmount = Number(order.customer_total);
        if (!Number.isFinite(callbackAmount) || !Number.isFinite(expectedAmount) || Math.round(callbackAmount) !== Math.round(expectedAmount) || String(order.currency || "").toUpperCase() !== "KES") {
          console.error("M-Pesa restaurant payment amount mismatch", {
            orderId: order.id,
            checkoutRequestId,
            callbackAmount,
            expectedAmount,
            currency: order.currency,
          });
          return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }
      }

      if (!["unpaid", "pending", "processing", "failed"].includes(String(order.payment_status))) {
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      const { error: foodUpdateError } = await supabaseAdmin
        .from("food_orders")
        .update({
          payment_status: resultCode === 0 ? "paid" : "failed",
          payment_reference: receipt || checkoutRequestId,
          payment_intent_id: order.payment_intent_id || checkoutRequestId,
        })
        .eq("id", order.id)
        .neq("payment_status", "paid");
      if (foodUpdateError) throw foodUpdateError;
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Only an idempotency record may identify a service payment. Never attach a
    // provider callback by searching for an arbitrary pending appointment.
    const { data: idem } = await supabaseAdmin
      .from("service_payment_idempotency")
      .select("appointment_id,provider_reference")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    if (!idem?.appointment_id) {
      // Unknown/late callbacks are acknowledged without mutating customer data.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: appointment } = await supabaseAdmin
      .from("service_appointments")
      .select("id,customer_total_amount,currency")
      .eq("id", idem.appointment_id)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Successful STK callbacks must carry a KES amount matching the booked total.
    // Do not let an unexpected amount mark the appointment paid.
    if (resultCode === 0) {
      const callbackAmount = Number(amountValue);
      const expectedAmount = Number(appointment.customer_total_amount);
      if (!Number.isFinite(callbackAmount) || !Number.isFinite(expectedAmount) || callbackAmount !== expectedAmount || String(appointment.currency).toUpperCase() !== "KES") {
        console.error("M-Pesa service payment amount mismatch", {
          appointmentId: appointment.id,
          checkoutRequestId,
          callbackAmount,
          expectedAmount,
          currency: appointment.currency,
        });
        return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
    }

    await recordAndApplyPaymentWebhook({
      eventId: `mpesa:${checkoutRequestId}:${resultCode}`,
      provider: "mpesa",
      eventType: resultCode === 0 ? "stkpush.success" : "stkpush.failed",
      providerReference: receipt ? String(receipt) : checkoutRequestId,
      appointmentId: appointment.id,
      status: resultCode === 0 ? "succeeded" : "failed",
      paidAt: resultCode === 0 ? new Date().toISOString() : null,
      refundedAmount: 0,
      rawPayload: { checkoutRequestId, resultCode, callback },
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
