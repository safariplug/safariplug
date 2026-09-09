import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ResultParameter = { Key?: unknown; Value?: unknown };

function parameterValue(parameters: ResultParameter[], key: string) {
  return parameters.find((item) => item?.Key === key)?.Value;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = payload?.Result;
    const transactionId = String(result?.TransactionID || "").trim();
    const conversationId = String(result?.ConversationID || "").trim() || null;
    const originatorConversationId = String(result?.OriginatorConversationID || "").trim() || null;
    const resultCode = Number(result?.ResultCode ?? -1);
    const resultDesc = result?.ResultDesc == null ? null : String(result.ResultDesc).slice(0, 1000);

    if (!Number.isFinite(resultCode) || (!transactionId && !conversationId && !originatorConversationId)) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const parameters = Array.isArray(result?.ResultParameters?.ResultParameter)
      ? (result.ResultParameters.ResultParameter as ResultParameter[])
      : [];
    const transactionAmount = Number(parameterValue(parameters, "TransactionAmount"));
    const transactionReceipt = String(parameterValue(parameters, "TransactionReceipt") || "").trim() || null;

    const query = supabaseAdmin
      .from("food_order_refunds")
      .select("id,order_id,amount,status")
      .eq("provider", "mpesa");

    const { data: refund } = originatorConversationId
      ? await query.eq("provider_reference", originatorConversationId).maybeSingle()
      : conversationId
        ? await query.eq("refund_reference", conversationId).maybeSingle()
        : { data: null };

    if (!refund) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (!["pending", "processing"].includes(String(refund.status))) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const expectedAmount = Number(refund.amount);
    if (resultCode === 0 && (!Number.isFinite(transactionAmount) || Math.round(transactionAmount) !== Math.round(expectedAmount))) {
      await supabaseAdmin.from("food_order_refunds").update({
        status: "failed",
        error_message: "M-Pesa reversal amount did not match the requested refund amount",
        updated_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      }).eq("id", refund.id);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const now = new Date().toISOString();
    if (resultCode !== 0) {
      await supabaseAdmin.from("food_order_refunds").update({
        status: "failed",
        error_message: resultDesc || "M-Pesa reversal failed",
        updated_at: now,
        processed_at: now,
      }).eq("id", refund.id).in("status", ["pending", "processing"]);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const refundReference = transactionReceipt || transactionId || conversationId || originatorConversationId;
    const { error: refundError } = await supabaseAdmin.from("food_order_refunds").update({
      status: "succeeded",
      refund_reference: refundReference,
      updated_at: now,
      processed_at: now,
      error_message: null,
    }).eq("id", refund.id).in("status", ["pending", "processing"]);
    if (refundError) throw refundError;

    const { error: orderError } = await supabaseAdmin.from("food_orders").update({
      payment_status: "refunded",
      refunded_amount: expectedAmount,
      refund_reference: refundReference,
      refunded_at: now,
      status: "cancelled",
      cancelled_at: now,
      cancellation_reason: "Restaurant refund completed",
      updated_at: now,
    }).eq("id", refund.order_id).eq("payment_status", "paid");
    if (orderError) throw orderError;

    await supabaseAdmin.from("food_delivery_assignments").update({
      status: "cancelled",
      updated_at: now,
      note: "Order refunded and cancelled",
    }).eq("order_id", refund.order_id).in("status", ["assigned", "accepted", "arrived_at_restaurant", "picked_up", "on_the_way"]);

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa reversal callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
