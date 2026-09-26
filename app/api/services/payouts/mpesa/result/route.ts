import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findServiceProviderPayoutByMpesaReferences } from "@/lib/payments/mpesa-payout-correlation";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.MPESA_B2C_CALLBACK_SECRET?.trim();
  if (!secret) return false;
  return new URL(request.url).searchParams.get("token") === secret;
}

function callbackError(status: number, description: string) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: description }, { status });
}

export async function POST(request: Request) {
  if (!authorized(request)) return callbackError(401, "Unauthorized");

  try {
    const body = await request.json();
    const result = body?.Result;
    const conversationId = String(result?.ConversationID || "").trim();
    const originatorConversationId = String(result?.OriginatorConversationID || "").trim();
    const resultCode = Number(result?.ResultCode);

    if (!conversationId && !originatorConversationId) {
      return callbackError(400, "Missing ConversationID");
    }
    if (!Number.isFinite(resultCode)) return callbackError(400, "Missing or invalid ResultCode");

    const payout = await findServiceProviderPayoutByMpesaReferences([conversationId,originatorConversationId]);

    if (!payout) {
      console.error("Unmatched M-Pesa B2C result callback", {
        conversationId,
        originatorConversationId,
        resultCode,
      });
      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type:"service_provider_payout_callback_unmatched",
        metadata:{kind:"result",conversationId:conversationId||null,originatorConversationId:originatorConversationId||null,resultCode,resultDescription:String(result?.ResultDesc||""),receivedAt:new Date().toISOString()}
      }).then(({error})=>{if(error)console.error("Failed to persist unmatched payout callback telemetry",error);});
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
        mpesa_conversation_id: conversationId || originatorConversationId,
        conversation_id: conversationId || null,
        originator_conversation_id: originatorConversationId || null,
        mpesa_transaction_id: transactionId ? String(transactionId) : null,
        mpesa_result_code: resultCode,
        mpesa_result_description: String(result?.ResultDesc || ""),
        metadata: {
          ...(payout.metadata && typeof payout.metadata === "object" && !Array.isArray(payout.metadata)
            ? payout.metadata
            : {}),
          b2c_result: body,
          conversationId: conversationId || null,
          originatorConversationId: originatorConversationId || null,
          resultCode,
          transactionReceipt: receipt ?? null,
        },
        payout_reference: receipt ? String(receipt) : (conversationId || originatorConversationId),
        updated_at: now,
      })
      .eq("id", payout.id)
      .in("status", ["processing", "approved"])
      .select("id,status")
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) {
      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type:"service_provider_payout_callback_applied",
        metadata:{kind:"result",payoutId:payout.id,status,conversationId:conversationId||null,originatorConversationId:originatorConversationId||null,resultCode,transactionReceipt:receipt??null}
      }).then(({error})=>{if(error)console.error("Failed to persist payout callback telemetry",error);});
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

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
      conversationId: conversationId || null,
      originatorConversationId: originatorConversationId || null,
      currentStatus: current?.status ?? null,
    });
    return callbackError(409, "Payout state was not updated");
  } catch (error) {
    console.error("M-Pesa B2C result callback persistence error", error);
    return callbackError(500, "Callback persistence failed");
  }
}
