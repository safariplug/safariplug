import { NextResponse } from "next/server";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function metadataAppointmentId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const id = (metadata as { appointment_id?: unknown }).appointment_id;
  return typeof id === "string" && id ? id : null;
}

function objectId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!(await verifyStripeWebhookSignature(payload, signature))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventId = typeof event.id === "string" ? event.id : null;
  const eventType = typeof event.type === "string" ? event.type : null;
  const object = event.data?.object;
  if (!eventId || !eventType || !object) return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  const appointmentId = metadataAppointmentId(object);
  const providerReference = objectId(object);

  let status: "succeeded" | "failed" | "cancelled" | "processing" | null = null;
  if (["checkout.session.completed", "payment_intent.succeeded"].includes(eventType)) status = "succeeded";
  else if (["checkout.session.async_payment_failed", "payment_intent.payment_failed"].includes(eventType)) status = "failed";
  else if (eventType === "checkout.session.expired") status = "cancelled";

  if (!status) return NextResponse.json({ received: true, ignored: true });
  if (!appointmentId || !providerReference) return NextResponse.json({ error: "payment_metadata_missing" }, { status: 400 });

  try {
    const result = await recordAndApplyPaymentWebhook({
      eventId,
      provider: "stripe",
      eventType,
      providerReference,
      appointmentId,
      status,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      refundedAmount: 0,
      rawPayload: event,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Stripe webhook processing error", error);
    return NextResponse.json({ error: "payment_application_failed" }, { status: 500 });
  }
}
