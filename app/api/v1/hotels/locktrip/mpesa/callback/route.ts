import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "");
    const resultCode = Number(callback?.ResultCode);
    if (!checkoutRequestId) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const { data: ledger } = await supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .select("id,metadata,payment_status,booking_status,customer_retail_amount,customer_currency")
      .eq("payment_provider", "mpesa")
      .eq("payment_reference", checkoutRequestId)
      .maybeSingle();
    if (!ledger) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (ledger.payment_status === "paid") return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
    const items = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const metadataMap = Object.fromEntries(items.map((item: { Name?: string; Value?: unknown }) => [String(item?.Name || ""), item?.Value ?? null]).filter(([key]) => key));
    const success = resultCode === 0;
    const update: Record<string, unknown> = {
      payment_status: success ? "paid" : "failed",
      booking_status: success ? "payment_pending" : "failed",
      paid_at: success ? new Date().toISOString() : null,
      metadata: {
        ...metadata,
        mpesaCallback: {
          resultCode,
          resultDescription: callback?.ResultDesc || null,
          receipt: metadataMap.MpesaReceiptNumber || null,
          amount: metadataMap.Amount || null,
          phone: metadataMap.PhoneNumber || null,
          transactionDate: metadataMap.TransactionDate || null,
          receivedAt: new Date().toISOString(),
        },
      },
    };
    await supabaseAdmin.from("hotel_booking_pricing_ledger").update(update).eq("id", ledger.id).eq("payment_provider", "mpesa").eq("payment_reference", checkoutRequestId);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Hotel M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
