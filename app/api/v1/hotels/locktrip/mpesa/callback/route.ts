import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: any;
  try { payload = await request.json(); } catch { return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }); }

  const callback = payload?.Body?.stkCallback;
  const checkoutRequestId = String(callback?.CheckoutRequestID || "");
  const resultCode = Number(callback?.ResultCode);
  if (!checkoutRequestId) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  const supabase = await createSupabaseServerClient();
  const { data: ledger } = await supabase.from("hotel_booking_pricing_ledger").select("id,metadata,payment_status,booking_status,customer_retail_amount,customer_currency").eq("payment_provider", "mpesa").eq("payment_reference", checkoutRequestId).maybeSingle();
  if (!ledger) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
  const callbackMetadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
  const metadataMap = Object.fromEntries(callbackMetadata.map((item: any) => [String(item?.Name || ""), item?.Value ?? null]).filter(([key]) => key));
  const update: Record<string, unknown> = {
    metadata: { ...metadata, mpesaCallback: { resultCode, resultDescription: callback?.ResultDesc || null, receipt: metadataMap.MpesaReceiptNumber || null, amount: metadataMap.Amount || null, phone: metadataMap.PhoneNumber || null, transactionDate: metadataMap.TransactionDate || null, receivedAt: new Date().toISOString() } }
  };

  if (resultCode === 0) {
    update.payment_status = "paid";
    update.booking_status = "payment_pending";
    update.paid_at = new Date().toISOString();
  } else {
    update.payment_status = "failed";
    update.booking_status = "failed";
  }

  await supabase.from("hotel_booking_pricing_ledger").update(update).eq("id", ledger.id).eq("payment_provider", "mpesa").eq("payment_reference", checkoutRequestId);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
