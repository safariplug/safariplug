import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
type Item = { Key?: unknown; Value?: unknown };
function value(items: Item[], key: string) { const item = items.find((entry) => String(entry?.Key || "") === key); return item?.Value == null ? null : String(item.Value); }
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = payload?.Result || payload?.result || {};
    const parameters = Array.isArray(result?.ResultParameters?.ResultParameter) ? result.ResultParameters.ResultParameter as Item[] : [];
    const originalTransactionId = value(parameters, "OriginalTransactionID");
    const reversalTransactionId = value(parameters, "TransactionID");
    const resultCode = String(result?.ResultCode ?? "");
    const originatorConversationId = String(result?.OriginatorConversationID || "").trim();
    const conversationId = String(result?.ConversationID || "").trim();
    const success = resultCode === "0";
    let query = supabaseAdmin.from("food_order_refunds").select("id,order_id,amount,status,provider_reference,refund_reference").eq("provider", "mpesa");
    if (originatorConversationId) query = query.eq("provider_reference", originatorConversationId); else if (conversationId) query = query.eq("refund_reference", conversationId); else if (originalTransactionId) {
      const { data: orders } = await supabaseAdmin.from("food_orders").select("id").eq("payment_reference", originalTransactionId).limit(1);
      if (orders?.[0]?.id) query = query.eq("order_id", orders[0].id);
    }
    const { data: refund } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!refund) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    const now = new Date().toISOString();
    if (!success) {
      await supabaseAdmin.from("food_order_refunds").update({ status: "failed", error_message: String(result?.ResultDesc || "M-Pesa reversal failed").slice(0, 1000), updated_at: now, processed_at: now }).eq("id", refund.id);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    await supabaseAdmin.from("food_order_refunds").update({ status: "succeeded", refund_reference: reversalTransactionId || refund.refund_reference, updated_at: now, processed_at: now }).eq("id", refund.id);
    await supabaseAdmin.from("food_orders").update({ payment_status: "refunded", refunded_amount: refund.amount, refund_reference: reversalTransactionId || conversationId || originatorConversationId || null, refunded_at: now, updated_at: now }).eq("id", refund.order_id).eq("payment_status", "paid");
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa reversal callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
