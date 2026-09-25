import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
type CallbackItem = { Name?: string; Value?: unknown };

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "");
    const resultCode = Number(callback?.ResultCode);
    if (!checkoutRequestId) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    const { data: ledger } = await supabaseAdmin.from("hotel_booking_pricing_ledger").select("id,metadata,payment_status,booking_status,customer_retail_amount,customer_currency").eq("payment_provider", "mpesa").eq("payment_reference", checkoutRequestId).maybeSingle();
    if (!ledger || ledger.payment_status === "paid") return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
    const items: CallbackItem[] = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const metadataMap: Record<string, unknown> = Object.fromEntries(items.map((item) => [String(item.Name || ""), item.Value ?? null]).filter(([key]) => Boolean(key)));
    const callbackAmount = Number(metadataMap.Amount);
    const expectedAmount = Number(ledger.customer_retail_amount);
    const receipt = String(metadataMap.MpesaReceiptNumber || "").trim();
    const amountMatches = Number.isFinite(callbackAmount) && Number.isFinite(expectedAmount)
      && Math.abs(callbackAmount - expectedAmount) <= 0.01;
    const success = resultCode === 0;
    const verifiedSuccess = success && amountMatches && Boolean(receipt);
    const callbackRecord = {
      resultCode,
      resultDescription: callback?.ResultDesc || null,
      receipt: receipt || null,
      amount: Number.isFinite(callbackAmount) ? callbackAmount : null,
      expectedAmount: Number.isFinite(expectedAmount) ? expectedAmount : null,
      amountMatches,
      phone: metadataMap.PhoneNumber || null,
      transactionDate: metadataMap.TransactionDate || null,
      receivedAt: new Date().toISOString(),
    };
    const update = verifiedSuccess
      ? {
          payment_status: "paid",
          booking_status: "payment_pending",
          paid_at: new Date().toISOString(),
          metadata: { ...metadata, mpesaCallback: callbackRecord },
        }
      : success
        ? {
            payment_status: "pending",
            booking_status: "payment_pending",
            paid_at: null,
            metadata: { ...metadata, mpesaCallbackRejected: callbackRecord },
          }
        : {
            payment_status: "failed",
            booking_status: "failed",
            paid_at: null,
            metadata: { ...metadata, mpesaCallback: callbackRecord },
          };
    await supabaseAdmin.from("hotel_booking_pricing_ledger").update(update).eq("id", ledger.id).eq("payment_provider", "mpesa").eq("payment_reference", checkoutRequestId);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Hotel M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
