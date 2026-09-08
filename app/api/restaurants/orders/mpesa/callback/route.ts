import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "");
    const resultCode = Number(callback?.ResultCode ?? -1);
    if (!checkoutRequestId) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    const metadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const receipt = metadata.find((item: any) => item?.Name === "MpesaReceiptNumber")?.Value;
    const { data: order } = await supabaseAdmin.from("food_orders").select("id,payment_reference").eq("payment_reference", checkoutRequestId).maybeSingle();
    if (order) {
      await supabaseAdmin.from("food_orders").update({ payment_status: resultCode === 0 ? "paid" : "failed", payment_reference: String(receipt || checkoutRequestId) }).eq("id", order.id);
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
