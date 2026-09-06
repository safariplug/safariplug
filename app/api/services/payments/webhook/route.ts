import { NextResponse } from "next/server";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";
import type { PaymentProvider, PaymentIntentStatus } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

const providers = new Set<PaymentProvider>(["stripe", "mpesa", "paystack", "flutterwave", "manual"]);
const statuses = new Set<PaymentIntentStatus>(["requires_payment", "processing", "succeeded", "failed", "cancelled"]);

/**
 * Generic webhook boundary. Processor-specific adapters must verify their
 * signature before calling the normalized application layer.
 * Do not expose this as a claim that any processor is configured.
 */
export async function POST(request: Request) {
  try {
    const provider = request.headers.get("x-safariplug-payment-provider") as PaymentProvider | null;
    const signatureVerified = request.headers.get("x-safariplug-signature-verified") === "1";

    if (!provider || !providers.has(provider)) return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });
    if (!signatureVerified) return NextResponse.json({ error: "Webhook signature verification is required." }, { status: 401 });

    const body = await request.json();
    const eventId = String(body.eventId || body.id || "");
    const eventType = String(body.eventType || body.type || "");
    const providerReference = String(body.providerReference || body.paymentReference || "");
    const status = String(body.status || "") as PaymentIntentStatus;

    if (!eventId || !eventType || !providerReference || !statuses.has(status)) {
      return NextResponse.json({ error: "Invalid normalized webhook payload." }, { status: 400 });
    }

    const result = await recordAndApplyPaymentWebhook({
      eventId,
      provider,
      eventType,
      providerReference,
      appointmentId: body.appointmentId ? String(body.appointmentId) : null,
      status,
      paidAt: body.paidAt || null,
      refundedAmount: Number(body.refundedAmount || 0),
      rawPayload: body,
    });

    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Payment webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
