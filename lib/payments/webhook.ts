import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PaymentProvider, PaymentIntentStatus } from "./types";

export type NormalizedPaymentWebhook = { eventId:string; provider:PaymentProvider; eventType:string; providerReference:string; appointmentId?:string|null; status:PaymentIntentStatus; paidAt?:string|null; refundedAmount?:number; rawPayload:unknown };
const statuses = new Set<PaymentIntentStatus>(["requires_payment", "processing", "succeeded", "failed", "cancelled"]);

export async function recordAndApplyPaymentWebhook(event: NormalizedPaymentWebhook) {
  if (!statuses.has(event.status)) throw new Error("invalid_payment_status");
  if (!event.appointmentId) throw new Error("payment_appointment_id_required");

  let eventId: string;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("service_payment_events")
    .insert({ provider:event.provider, event_id:event.eventId, event_type:event.eventType, appointment_id:event.appointmentId, provider_reference:event.providerReference, payload:event.rawPayload, status:"received" })
    .select("id,status")
    .maybeSingle();

  if (insertError) {
    if (insertError.code !== "23505") throw insertError;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("service_payment_events")
      .select("id,status")
      .eq("provider", event.provider)
      .eq("event_id", event.eventId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("payment_event_duplicate_not_found");
    if (existing.status === "processed") return { duplicate:true };
    eventId = existing.id;
  } else {
    if (!inserted) throw new Error("payment_event_insert_failed");
    eventId = inserted.id;
  }

  const normalizedStatus = event.status === "succeeded" ? "paid" : event.status === "failed" ? "failed" : event.status === "cancelled" ? "cancelled" : "pending";
  const { data: result, error } = await supabaseAdmin.rpc("apply_service_payment_webhook", { p_appointment_id:event.appointmentId, p_payment_reference:event.providerReference, p_status:normalizedStatus, p_paid_at:event.paidAt ?? null, p_refunded_amount:event.refundedAmount ?? 0 });
  if (error) {
    await supabaseAdmin.from("service_payment_events").update({ status:"failed", error_message:error.message }).eq("id", eventId);
    throw error;
  }

  const { error: processedError } = await supabaseAdmin
    .from("service_payment_events")
    .update({ status:"processed", processed_at:new Date().toISOString(), error_message:null })
    .eq("id", eventId)
    .in("status", ["received", "failed"]);
  if (processedError) throw processedError;

  return { duplicate:false, result };
}
