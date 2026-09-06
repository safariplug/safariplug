import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "./registry";
import type { PaymentProvider } from "./types";

export async function createServicePaymentIntent(params: {
  appointmentId: string;
  customerUserId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  returnUrl?: string | null;
}) {
  const { data: appointment, error } = await supabaseAdmin
    .from("service_appointments")
    .select("id,customer_email,customer_phone,price,currency,payment_status,status,customer_user_id")
    .eq("id", params.appointmentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load appointment");
  if (!appointment || appointment.customer_user_id !== params.customerUserId) throw new Error("appointment_not_found");
  if (["cancelled", "no_show"].includes(appointment.status)) throw new Error("appointment_not_payable");
  if (appointment.payment_status === "paid") throw new Error("appointment_already_paid");

  const { data: existing } = await supabaseAdmin
    .from("service_payment_idempotency")
    .select("provider_reference,payment_intent_id")
    .eq("customer_user_id", params.customerUserId)
    .eq("provider", params.provider)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();
  if (existing?.payment_intent_id) {
    return { id: existing.payment_intent_id, provider: params.provider, providerReference: existing.provider_reference, appointmentId: appointment.id, amount: Number(appointment.price), currency: String(appointment.currency).toUpperCase(), status: "processing" as const, checkoutUrl: null, clientSecret: null };
  }

  const adapter = getPaymentAdapter(params.provider);
  if (!adapter) throw new Error(`payment_provider_not_configured:${params.provider}`);

  const intent = await adapter.createPaymentIntent({
    appointmentId: appointment.id,
    amount: Number(appointment.price),
    currency: String(appointment.currency).toUpperCase(),
    customerEmail: appointment.customer_email,
    customerPhone: appointment.customer_phone,
    returnUrl: params.returnUrl,
    idempotencyKey: params.idempotencyKey,
  });

  const { error: idemError } = await supabaseAdmin.from("service_payment_idempotency").insert({
    appointment_id: appointment.id,
    customer_user_id: params.customerUserId,
    provider: params.provider,
    idempotency_key: params.idempotencyKey,
    payment_intent_id: intent.id,
    provider_reference: intent.providerReference,
  });
  if (idemError && !idemError.message.toLowerCase().includes("duplicate")) throw new Error("Unable to persist payment idempotency record");

  await supabaseAdmin.from("service_appointments").update({
    payment_status: intent.status === "succeeded" ? "paid" : "pending",
    payment_reference: intent.providerReference,
    paid_at: intent.status === "succeeded" ? new Date().toISOString() : null,
  }).eq("id", appointment.id);

  return intent;
}
