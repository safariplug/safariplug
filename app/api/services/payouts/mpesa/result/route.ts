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
      .eq("payout_reference", conversationId)
      .maybeSingle();

    if (!payout) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (["paid", "failed"].includes(payout.status)) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const status = resultCode === 0 ? "paid" : "failed";
    const failureReason = resultCode === 0 ? null : String(result?.ResultDesc || "M-Pesa B2C payout failed");
    const metadata = Array.isArray(result?.ResultParameters?.ResultParameter) ? result.ResultParameters.ResultParameter : [];
    const receipt = metadata.find((item: { Key?: string }) => item.Key === "TransactionReceipt")?.Value;

    const { error } = await supabaseAdmin
      .from("service_provider_payouts")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        failure_reason: failureReason,
        metadata: { conversationId, resultCode, result: body, transactionReceipt: receipt ?? null },
        payout_reference: receipt ? String(receipt) : conversationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    if (error) throw error;
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa B2C result callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
