import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "");
    if (!checkoutRequestId) return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing CheckoutRequestID" }, { status: 400 });

    const { data: idem } = await supabaseAdmin
      .from("service_payment_idempotency")
      .select("appointment_id")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    if (!idem?.appointment_id) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const resultCode = Number(callback?.ResultCode);
    const metadata = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const receipt = metadata.find((item: { Name?: string }) => item.Name === "MpesaReceiptNumber")?.Value;
    const amount = metadata.find((item: { Name?: string }) => item.Name === "Amount")?.Value;
    const eventId = `mpesa:${checkoutRequestId}:${resultCode}`;

    await recordAndApplyPaymentWebhook({
      eventId,
      provider: "mpesa",
      eventType: resultCode === 0 ? "stkpush.success" : "stkpush.failed",
      providerReference: receipt ? String(receipt) : checkoutRequestId,
      appointmentId: idem.appointment_id,
      status: resultCode === 0 ? "succeeded" : "failed",
      paidAt: resultCode === 0 ? new Date().toISOString() : null,
      refundedAmount: 0,
      rawPayload: { checkoutRequestId, resultCode, amount: amount ?? null, callback },
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
