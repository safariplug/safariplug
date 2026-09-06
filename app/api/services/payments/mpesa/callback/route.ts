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

    // Normally the idempotency record is the authoritative mapping. The appointment
    // payment reference is a second recovery path for the narrow callback race where
    // Safaricom responds before the idempotency row has finished committing.
    const { data: idem } = await supabaseAdmin
      .from("service_payment_idempotency")
      .select("appointment_id")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    let appointmentId = idem?.appointment_id ?? null;
    if (!appointmentId) {
      const { data: appointment } = await supabaseAdmin
        .from("service_appointments")
        .select("id")
        .eq("payment_status", "pending")
        .eq("payment_reference", checkoutRequestId)
        .maybeSingle();
      appointmentId = appointment?.id ?? null;
    }

    // Safaricom expects an acknowledgement. Reconciliation can recover an accepted
    // callback if both mappings are temporarily unavailable.
    if (!appointmentId) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

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
      appointmentId,
      status: resultCode === 0 ? "succeeded" : "failed",
      paidAt: resultCode === 0 ? new Date().toISOString() : null,
      refundedAmount: 0,
      rawPayload: { checkoutRequestId, resultCode, amount: amount ?? null, callback },
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error", error);
    // A 200 acknowledgement prevents unnecessary callback retries while the payment
    // remains recoverable through the STK status query/reconciliation path.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
