import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ResultParameter = { Key?: unknown; Value?: unknown };

function parameterValue(parameters: ResultParameter[], key: string) {
  return parameters.find((item) => String(item?.Key || "") === key)?.Value;
}

function callbackError(status: number, description: string) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: description }, { status });
}

export async function handleRestaurantMpesaReversalCallback(request: Request) {
  try {
    const payload = await request.json();
    const result = payload?.Result || payload?.result;
    const transactionId = String(result?.TransactionID || "").trim();
    const conversationId = String(result?.ConversationID || "").trim() || null;
    const originatorConversationId = String(result?.OriginatorConversationID || "").trim() || null;
    const rawResultCode = result?.ResultCode;
    const resultCode = Number(rawResultCode);
    const resultDesc = result?.ResultDesc == null ? null : String(result.ResultDesc).slice(0, 1000);

    if (rawResultCode == null || !Number.isFinite(resultCode)) {
      return callbackError(400, "Invalid reversal callback");
    }

    const parameters = Array.isArray(result?.ResultParameters?.ResultParameter)
      ? (result.ResultParameters.ResultParameter as ResultParameter[])
      : [];
    const transactionAmount = Number(parameterValue(parameters, "TransactionAmount"));
    const transactionReceipt = String(parameterValue(parameters, "TransactionReceipt") || "").trim() || null;
    const parameterTransactionId = String(parameterValue(parameters, "TransactionID") || "").trim() || null;
    const originalTransactionId = String(parameterValue(parameters, "OriginalTransactionID") || "").trim() || null;

    if (!transactionId && !conversationId && !originatorConversationId && !originalTransactionId) {
      return callbackError(400, "Invalid reversal callback");
    }

    let refund:
      | { id: string; order_id: string; amount: number; status: string }
      | null = null;

    if (originatorConversationId) {
      const resultByOriginator = await supabaseAdmin
        .from("food_order_refunds")
        .select("id,order_id,amount,status")
        .eq("provider", "mpesa")
        .eq("provider_reference", originatorConversationId)
        .maybeSingle();
      if (resultByOriginator.error) throw resultByOriginator.error;
      refund = resultByOriginator.data;
    }

    if (!refund && conversationId) {
      const resultByConversation = await supabaseAdmin
        .from("food_order_refunds")
        .select("id,order_id,amount,status")
        .eq("provider", "mpesa")
        .eq("refund_reference", conversationId)
        .maybeSingle();
      if (resultByConversation.error) throw resultByConversation.error;
      refund = resultByConversation.data;
    }

    if (!refund && originalTransactionId) {
      const orderResult = await supabaseAdmin
        .from("food_orders")
        .select("id")
        .eq("payment_reference", originalTransactionId)
        .limit(2);
      if (orderResult.error) throw orderResult.error;
      if ((orderResult.data || []).length !== 1) {
        return callbackError(409, "Refund callback original transaction is ambiguous");
      }

      const activeRefundResult = await supabaseAdmin
        .from("food_order_refunds")
        .select("id,order_id,amount,status")
        .eq("provider", "mpesa")
        .eq("order_id", orderResult.data![0].id)
        .in("status", ["pending", "processing"])
        .maybeSingle();
      if (activeRefundResult.error) throw activeRefundResult.error;
      refund = activeRefundResult.data;
    }

    if (!refund) return callbackError(409, "Refund callback could not be matched");

    if (!["pending", "processing"].includes(String(refund.status))) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const expectedAmount = Number(refund.amount);
    if (
      resultCode === 0 &&
      (!Number.isFinite(transactionAmount) || Math.abs(transactionAmount - expectedAmount) > 0.005)
    ) {
      const { error: mismatchError } = await supabaseAdmin
        .from("food_order_refunds")
        .update({
          error_message:
            "M-Pesa reversal amount did not match the requested refund amount; reconciliation required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", refund.id)
        .in("status", ["pending", "processing"]);
      if (mismatchError) throw mismatchError;
      return callbackError(409, "Refund amount requires reconciliation");
    }

    if (resultCode !== 0) {
      const now = new Date().toISOString();
      const { error: failedUpdateError } = await supabaseAdmin
        .from("food_order_refunds")
        .update({
          status: "failed",
          error_message: resultDesc || "M-Pesa reversal failed",
          updated_at: now,
          processed_at: now,
        })
        .eq("id", refund.id)
        .in("status", ["pending", "processing"]);
      if (failedUpdateError) throw failedUpdateError;
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const refundReference =
      transactionReceipt ||
      parameterTransactionId ||
      transactionId ||
      conversationId ||
      originatorConversationId;

    const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc(
      "finalize_restaurant_refund",
      {
        p_refund_id: refund.id,
        p_amount: expectedAmount,
        p_refund_reference: refundReference,
      },
    );
    if (finalizeError) throw finalizeError;
    if (!Array.isArray(finalized) || finalized[0]?.success !== true) {
      throw new Error(
        `Restaurant refund finalization was not completed: ${finalized?.[0]?.status || "unknown"}`,
      );
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa reversal callback error", error);
    return callbackError(500, "Refund callback persistence failed");
  }
}
