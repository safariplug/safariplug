import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = body?.Result;
    const conversationId = String(result?.ConversationID || result?.OriginatorConversationID || "");
    const resultCode = Number(result?.ResultCode);
    if (!conversationId) return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing ConversationID" }, { status: 400 });

    const { data: payout } = await supabaseAdmin
      .from("service_provider_payouts")
      .select("id,status")
      .or(`mpesa_conversation_id.eq.${conversationId},payout_reference.eq.${conversationId}`)
      .maybeSingle();

    if (!payout) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (["paid", "failed", "cancelled"].includes(payout.status)) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const metadata = Array.isArray(result?.ResultParameters?.ResultParameter) ? result.ResultParameters.ResultParameter : [];
    const valueFor = (key: string) => metadata.find((item: { Key?: string }) => item.Key === key)?.Value;
    const receipt = valueFor("TransactionReceipt");
    const transactionId = valueFor("TransactionID") || receipt;
    const status = resultCode === 0 ? "paid" : "failed";
    const failureReason = resultCode === 0 ? null : String(result?.ResultDesc || "M-Pesa B2C payout failed");

    const { error } = await supabaseAdmin
      .from("service_provider_payouts")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        failure_reason: failureReason,
        mpesa_conversation_id: conversationId,
        mpesa_transaction_id: transactionId ? String(transactionId) : null,
        mpesa_result_code: resultCode,
        mpesa_result_description: String(result?.ResultDesc || ""),
        metadata: { conversationId, resultCode, result: body, transactionReceipt: receipt ?? null },
        payout_reference: receipt ? String(receipt) : conversationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)
      .in("status", ["processing", "approved"]);

    if (error) throw error;
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa B2C result callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
