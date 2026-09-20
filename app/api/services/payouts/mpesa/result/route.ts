import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.MPESA_B2C_CALLBACK_SECRET?.trim();
  if (!secret) return false;
  return new URL(request.url).searchParams.get("token") === secret;
}

function callbackError(status: number, description: string) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: description }, { status });
}

async function findPayout(conversationId: string) {
  const byConversation = await supabaseAdmin
    .from("service_provider_payouts")
    .select("id,status,metadata")
    .eq("mpesa_conversation_id", conversationId)
    .maybeSingle();

  if (byConversation.error) throw byConversation.error;
  if (byConversation.data) return byConversation.data;

  const byReference = await supabaseAdmin
    .from("service_provider_payouts")
    .select("id,status,metadata")
    .eq("payout_reference", conversationId)
    .maybeSingle();

  if (byReference.error) throw byReference.error;
  return byReference.data;
}

export async function POST(request: Request) {
  if (!authorized(request)) return callbackError(401, "Unauthorized");

  try {
    const body = await request.json();
    const result = body?.Result;
    const conversationId = String(result?.ConversationID || result?.OriginatorConversationID || "").trim();
    const resultCode = Number(result?.ResultCode);

    if (!conversationId) return callbackError(400, "Missing ConversationID");
    if (!Number.isFinite(resultCode)) return callbackError(400, "Missing or invalid ResultCode");

    const payout = await findPayout(conversationId);

    if (!payout) {
      console.error("Unmatched M-Pesa B2C result callback", { conversationId, resultCode });
      return callbackError(409, "Payout callback could not be matched");
    }

    if (["paid", "failed", "cancelled"].includes(payout.status)) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const metadata = Array.isArray(result?.ResultParameters?.ResultParameter)
      ? result.ResultParameters.ResultParameter
      : [];
    const valueFor = (key: string) =>
      metadata.find((item: { Key?: string }) => item.Key === key)?.Value;
    const receipt = valueFor("TransactionReceipt");
    const transactionId = valueFor("TransactionID") || receipt;
    const status = resultCode === 0 ? "paid" : "failed";
    const failureReason =
      resultCode === 0 ? null : String(result?.ResultDesc || "M-Pesa B2C payout failed");
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("service_provider_payouts")
      .update({
        status,
        paid_at: status === "paid" ? now : null,
        failure_reason: failureReason,
        mpesa_conversation_id: conversationId,
        mpesa_transaction_id: transactionId ? String(transactionId) : null,
        mpesa_result_code: resultCode,
        mpesa_result_description: String(result?.ResultDesc || ""),
        metadata: {
          ...(payout.metadata && typeof payout.metadata === "object" && !Array.isArray(payout.metadata)
            ? payout.metadata
            : {}),
          b2c_result: body,
          conversationId,
          resultCode,
          transactionReceipt: receipt ?? null,
        },
        payout_reference: receipt ? String(receipt) : conversationId,
        updated_at: now,
      })
      .eq("id", payout.id)
      .in("status", ["processing", "approved"])
      .select("id,status")
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const { data: current, error: currentError } = await supabaseAdmin
      .from("service_provider_payouts")
      .select("status")
      .eq("id", payout.id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (current && ["paid", "failed", "cancelled"].includes(current.status)) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    console.error("M-Pesa B2C callback did not update payout state", {
      payoutId: payout.id,
      conversationId,
      currentStatus: current?.status ?? null,
    });
    return callbackError(409, "Payout state was not updated");
  } catch (error) {
    console.error("M-Pesa B2C result callback persistence error", error);
    return callbackError(500, "Callback persistence failed");
  }
}
