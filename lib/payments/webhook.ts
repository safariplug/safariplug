import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PaymentProvider, PaymentIntentStatus } from "./types";

export type NormalizedPaymentWebhook = {
  eventId: string;
  provider: PaymentProvider;
  eventType: string;
  providerReference: string;
  appointmentId?: string | null;
  status: PaymentIntentStatus;
  paidAt?: string | null;
  refundedAmount?: number;
  rawPayload: unknown;
};

const statuses = new Set<PaymentIntentStatus>([
  "requires_payment", "processing", "succeeded", "failed", "cancelled",
]);

export async function recordAndApplyPaymentWebhook(event: NormalizedPaymentWebhook) {
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("service_payment_webhook_events")
    .insert({
      provider: event.provider,
      event_id: event.eventId,
      event_type: event.eventType,
      provider_reference: event.providerReference,
      payload: event.rawPayload,
      status: "received",
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") return { duplicate: true };
    throw insertError;
  }

  if (!statuses.has(event.status)) throw new Error("invalid_payment_status");

  const { data: result, error } = await supabaseAdmin.rpc("apply_service_payment_webhook", {
    p_appointment_id: event.appointmentId ?? null,
    p_payment_reference: event.providerReference,
    p_status: event.status === "succeeded" ? "paid" : event.status === "failed" ? "failed" : "pending",
    p_paid_at: event.paidAt ?? null,
    p_refunded_amount: event.refundedAmount ?? 0,
  });

  if (error) {
    await supabaseAdmin.from("service_payment_webhook_events").update({ status: "failed", error_message: error.message }).eq("id", inserted?.id);
    throw error;
  }

  await supabaseAdmin.from("service_payment_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", inserted?.id);
  return { duplicate: false, result };
}
