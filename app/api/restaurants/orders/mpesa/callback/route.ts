import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "");
    const resultCode = Number(callback?.ResultCode ?? -1);
    if (!checkoutRequestId) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" }, { status: 400 });
    }

    const metadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const receipt = metadata.find((item: { Name?: unknown }) => item?.Name === "MpesaReceiptNumber")?.Value;
    const paymentStatus = resultCode === 0 ? "paid" : "failed";
    const paymentReference = receipt ? String(receipt) : checkoutRequestId;

    const { data: payment } = await supabaseAdmin
      .from("food_order_payment_idempotency")
      .select("order_id")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    if (!payment?.order_id) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { error } = await supabaseAdmin
      .from("food_orders")
      .update({ payment_status: paymentStatus, payment_reference: paymentReference })
      .eq("id", payment.order_id)
      .neq("payment_status", "paid");

    if (error) throw error;
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Restaurant M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
