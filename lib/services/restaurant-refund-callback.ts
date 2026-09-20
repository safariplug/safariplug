import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ResultParameter = { Key?: unknown; Value?: unknown };
type RefundRow = { id: string; order_id: string; amount: number; status: string };

function parameterValue(parameters: ResultParameter[], key: string) {
  return parameters.find((item) => String(item?.Key || "") === key)?.Value;
}

function callbackError(status: number, description: string) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: description }, { status });
}

function callbackSecret() {
  return (
    process.env.MPESA_REVERSAL_CALLBACK_SECRET?.trim() ||
    process.env.MPESA_B2C_CALLBACK_SECRET?.trim() ||
    ""
  );
}

function authorizeCallback(request: Request) {
  const secret = callbackSecret();
  if (!secret) return false;
  return new URL(request.url).searchParams.get("token") === secret;
}

function resultObject(payload: Record<string, unknown>) {
  const upper = payload.Result;
  if (upper && typeof upper === "object" && !Array.isArray(upper)) {
    return upper as Record<string, unknown>;
  }
  const lower = payload.result;
  if (lower && typeof lower === "object" && !Array.isArray(lower)) {
    return lower as Record<string, unknown>;
  }
  return payload;
}

function resultParameters(result: Record<string, unknown>) {
  const container = result.ResultParameters;
  if (!container || typeof container !== "object" || Array.isArray(container)) return [] as ResultParameter[];
  const raw = (container as { ResultParameter?: unknown }).ResultParameter;
  return Array.isArray(raw) ? raw as ResultParameter[] : [];
}

async function findRefund(
  originatorConversationId: string | null,
  conversationId: string | null,
  originalTransactionId: string | null,
): Promise<RefundRow | null> {
  if (originatorConversationId) {
    const match = await supabaseAdmin
      .from("food_order_refunds")
      .select("id,order_id,amount,status")
      .eq("provider", "mpesa")
      .eq("provider_reference", originatorConversationId)
      .limit(2);
    if (match.error) throw match.error;
    if ((match.data || []).length > 1) throw new Error("ambiguous_refund_provider_reference");
    if (match.data?.[0]) return match.data[0] as RefundRow;
  }

  if (conversationId) {
    const match = await supabaseAdmin
      .from("food_order_refunds")
      .select("id,order_id,amount,status")
      .eq("provider", "mpesa")
      .eq("refund_reference", conversationId)
      .limit(2);
    if (match.error) throw match.error;
    if ((match.data || []).length > 1) throw new Error("ambiguous_refund_conversation_reference");
    if (match.data?.[0]) return match.data[0] as RefundRow;
  }

  if (!originalTransactionId) return null;

  const orderResult = await supabaseAdmin
    .from("food_orders")
    .select("id")
    .eq("payment_reference", originalTransactionId)
    .limit(2);
  if (orderResult.error) throw orderResult.error;
  if ((orderResult.data || []).length !== 1) {
    throw new Error("ambiguous_refund_original_transaction");
  }

  const refundResult = await supabaseAdmin
    .from("food_order_refunds")
    .select("id,order_id,amount,status")
    .eq("provider", "mpesa")
    .eq("order_id", orderResult.data![0].id)
    .order("created_at", { ascending: false })
    .limit(2);
  if (refundResult.error) throw refundResult.error;

  const active = (refundResult.data || []).filter((row) =>
    ["pending", "processing"].includes(String(row.status)),
  );
  if (active.length === 1) return active[0] as RefundRow;
  if (active.length > 1) throw new Error("ambiguous_active_refund");

  if ((refundResult.data || []).length === 1) {
    return refundResult.data![0] as RefundRow;
  }
  return null;
}

export async function handleRestaurantMpesaReversalCallback(request: Request) {
  if (!authorizeCallback(request)) {
    return callbackError(401, "Unauthorized");
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const result = resultObject(payload);
    const transactionId = String(result.TransactionID || "").trim();
    const conversationId = String(result.ConversationID || "").trim() || null;
    const originatorConversationId = String(result.OriginatorConversationID || "").trim() || null;
    const rawResultCode = result.ResultCode;
    const resultCode = Number(rawResultCode);
    const resultDesc = result.ResultDesc == null ? null : String(result.ResultDesc).slice(0, 1000);
    const parameters = resultParameters(result);
    const transactionAmount = Number(parameterValue(parameters, "TransactionAmount"));
    const transactionReceipt = String(parameterValue(parameters, "TransactionReceipt") || "").trim() || null;
    const parameterTransactionId = String(parameterValue(parameters, "TransactionID") || "").trim() || null;
    const originalTransactionId = String(parameterValue(parameters, "OriginalTransactionID") || "").trim() || null;

    if (
      rawResultCode == null ||
      !Number.isFinite(resultCode) ||
      (!transactionId && !conversationId && !originatorConversationId && !originalTransactionId)
    ) {
      return callbackError(400, "Invalid reversal callback");
    }

    let refund: RefundRow | null;
    try {
      refund = await findRefund(originatorConversationId, conversationId, originalTransactionId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ambiguous_")) {
        console.error("Ambiguous restaurant M-Pesa reversal callback", error);
        return callbackError(409, "Refund callback correlation is ambiguous");
      }
      throw error;
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
      const { data: failedRefund, error: failedUpdateError } = await supabaseAdmin
        .from("food_order_refunds")
        .update({
          status: "failed",
          error_message: resultDesc || "M-Pesa reversal failed",
          updated_at: now,
          processed_at: now,
        })
        .eq("id", refund.id)
        .in("status", ["pending", "processing"])
        .select("id,status")
        .maybeSingle();
      if (failedUpdateError) throw failedUpdateError;
      if (!failedRefund) return callbackError(409, "Refund failure state was not persisted");
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

export async function handleRestaurantMpesaReversalTimeout(request: Request) {
  if (!authorizeCallback(request)) {
    return callbackError(401, "Unauthorized");
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const result = resultObject(payload);
    const conversationId = String(result.ConversationID || "").trim() || null;
    const originatorConversationId = String(result.OriginatorConversationID || "").trim() || null;
    const parameters = resultParameters(result);
    const originalTransactionId =
      String(parameterValue(parameters, "OriginalTransactionID") || "").trim() || null;

    if (!conversationId && !originatorConversationId && !originalTransactionId) {
      return callbackError(400, "Invalid reversal timeout callback");
    }

    let refund: RefundRow | null;
    try {
      refund = await findRefund(originatorConversationId, conversationId, originalTransactionId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ambiguous_")) {
        console.error("Ambiguous restaurant M-Pesa reversal timeout", error);
        return callbackError(409, "Refund timeout correlation is ambiguous");
      }
      throw error;
    }

    if (!refund) return callbackError(409, "Refund timeout could not be matched");

    if (!["pending", "processing"].includes(String(refund.status))) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("food_order_refunds")
      .update({
        error_message:
          "M-Pesa reversal queue timeout; reconciliation required before any retry",
        updated_at: now,
      })
      .eq("id", refund.id)
      .in("status", ["pending", "processing"])
      .select("id,status")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return callbackError(409, "Refund timeout state was not persisted");

    console.warn("Restaurant M-Pesa reversal timeout requires reconciliation", {
      refundId: refund.id,
      conversationId,
      originatorConversationId,
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa reversal timeout callback error", error);
    return callbackError(500, "Refund timeout persistence failed");
  }
}
