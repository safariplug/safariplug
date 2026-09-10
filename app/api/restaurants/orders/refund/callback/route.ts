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
      }).eq("id", refund.id).in("status", ["pending", "processing"]);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (resultCode !== 0) {
      const now = new Date().toISOString();
      await supabaseAdmin.from("food_order_refunds").update({
        status: "failed",
        error_message: resultDesc || "M-Pesa reversal failed",
        updated_at: now,
        processed_at: now,
      }).eq("id", refund.id).in("status", ["pending", "processing"]);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const refundReference = transactionReceipt || transactionId || conversationId || originatorConversationId;
    const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc("finalize_restaurant_refund", {
      p_refund_id: refund.id,
      p_amount: expectedAmount,
      p_refund_reference: refundReference,
    });
    if (finalizeError) throw finalizeError;
    if (!Array.isArray(finalized) || finalized[0]?.success !== true) {
      throw new Error(`Restaurant refund finalization was not completed: ${finalized?.[0]?.status || "unknown"}`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa reversal callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
