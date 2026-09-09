import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "./registry";
import type { PaymentProvider } from "./types";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export async function createServicePaymentIntent(params: {
  appointmentId: string;
  customerUserId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  returnUrl?: string | null;
}) {
  const { data: appointment, error } = await supabaseAdmin
    .from("service_appointments")
    .select("id,customer_email,customer_phone,price,customer_total_amount,currency,payment_status,status,customer_user_id")
    .eq("id", params.appointmentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load appointment");
  if (!appointment || appointment.customer_user_id !== params.customerUserId) throw new Error("appointment_not_found");
  if (!["pending", "confirmed"].includes(appointment.status)) throw new Error("appointment_not_payable");
  if (appointment.payment_status === "paid") throw new Error("appointment_already_paid");

  const amount = Number(appointment.customer_total_amount ?? appointment.price);
  const currency = String(appointment.currency ?? "").trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_payment_amount");
  if (!CURRENCY_PATTERN.test(currency)) throw new Error("invalid_payment_currency");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("service_payment_idempotency")
    .select("appointment_id,provider_reference,payment_intent_id")
    .eq("customer_user_id", params.customerUserId)
    .eq("provider", params.provider)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();
  if (existingError) throw new Error("Unable to check payment idempotency");
  if (existing && existing.appointment_id !== appointment.id) {
    throw new Error("payment_idempotency_key_reused");
  }
  if (existing?.payment_intent_id) {
    return { id: existing.payment_intent_id, provider: params.provider, providerReference: existing.provider_reference, appointmentId: appointment.id, amount, currency, status: "processing" as const, checkoutUrl: null, clientSecret: null };
  }

  const adapter = getPaymentAdapter(params.provider);
  if (!adapter) throw new Error(`payment_provider_not_configured:${params.provider}`);

  const intent = await adapter.createPaymentIntent({
    appointmentId: appointment.id,
    amount,
    currency,
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
  if (idemError) {
    if (idemError.code === "23505" || idemError.message.toLowerCase().includes("duplicate")) {
      const { data: raced } = await supabaseAdmin.from("service_payment_idempotency")
        .select("appointment_id,payment_intent_id,provider_reference")
        .eq("customer_user_id", params.customerUserId)
        .eq("provider", params.provider)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      if (raced?.appointment_id !== appointment.id || !raced.payment_intent_id) throw new Error("payment_idempotency_key_reused");
      return { ...intent, id: raced.payment_intent_id, providerReference: raced.provider_reference, appointmentId: appointment.id, amount, currency };
    }
    throw new Error("Unable to persist payment idempotency record");
  }

  const { error: appointmentUpdateError } = await supabaseAdmin.from("service_appointments").update({
    payment_status: intent.status === "succeeded" ? "paid" : "pending",
    payment_reference: intent.providerReference,
    paid_at: intent.status === "succeeded" ? new Date().toISOString() : null,
  }).eq("id", appointment.id).eq("customer_user_id", params.customerUserId).neq("payment_status", "paid");
  if (appointmentUpdateError) throw new Error("Unable to persist appointment payment state");

  return intent;
}
