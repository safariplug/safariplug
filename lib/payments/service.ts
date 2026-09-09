import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "./registry";
import { recordAndApplyPaymentWebhook } from "./webhook";
import type { PaymentProvider } from "./types";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const PAYMENT_CLAIM_MS = 10 * 60_000;

async function loadIdempotency(customerUserId: string, provider: PaymentProvider, idempotencyKey: string) {
  const { data, error } = await supabaseAdmin
    .from("service_payment_idempotency")
    .select("appointment_id,provider_reference,payment_intent_id,processing_until")
    .eq("customer_user_id", customerUserId)
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error("Unable to check payment idempotency");
  return data;
}

async function claimIdempotency(params: {
  appointmentId: string;
  customerUserId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
}) {
  const processingUntil = new Date(Date.now() + PAYMENT_CLAIM_MS).toISOString();
  const existing = await loadIdempotency(params.customerUserId, params.provider, params.idempotencyKey);

  if (existing) {
    if (existing.appointment_id !== params.appointmentId) throw new Error("payment_idempotency_key_reused");
    if (existing.payment_intent_id) return existing;
    if (existing.processing_until && new Date(existing.processing_until).getTime() > Date.now()) {
      throw new Error("payment_intent_in_progress");
    }
    const { data: claimed, error } = await supabaseAdmin
      .from("service_payment_idempotency")
      .update({ processing_until: processingUntil })
      .eq("customer_user_id", params.customerUserId)
      .eq("provider", params.provider)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("appointment_id", params.appointmentId)
      .is("payment_intent_id", null)
      .or(`processing_until.is.null,processing_until.lt.${new Date().toISOString()}`)
      .select("appointment_id,provider_reference,payment_intent_id,processing_until")
      .maybeSingle();
    if (error) throw new Error("Unable to claim payment idempotency key");
    if (!claimed) throw new Error("payment_intent_in_progress");
    return claimed;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("service_payment_idempotency")
    .insert({
      appointment_id: params.appointmentId,
      customer_user_id: params.customerUserId,
      provider: params.provider,
      idempotency_key: params.idempotencyKey,
      processing_until: processingUntil,
    })
    .select("appointment_id,provider_reference,payment_intent_id,processing_until")
    .single();
  if (!error) return inserted;
  if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
    const raced = await loadIdempotency(params.customerUserId, params.provider, params.idempotencyKey);
    if (raced?.appointment_id !== params.appointmentId) throw new Error("payment_idempotency_key_reused");
    if (raced?.payment_intent_id) return raced;
    throw new Error("payment_intent_in_progress");
  }
  throw new Error("Unable to reserve payment idempotency key");
}

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

  const claimed = await claimIdempotency(params);
  if (claimed.payment_intent_id) {
    return {
      id: claimed.payment_intent_id,
      provider: params.provider,
      providerReference: claimed.provider_reference,
      appointmentId: appointment.id,
      amount,
      currency,
      status: "processing" as const,
      checkoutUrl: null,
      clientSecret: null,
    };
  }

  const adapter = getPaymentAdapter(params.provider);
  if (!adapter) {
    await supabaseAdmin.from("service_payment_idempotency").delete()
      .eq("customer_user_id", params.customerUserId).eq("provider", params.provider)
      .eq("idempotency_key", params.idempotencyKey).eq("appointment_id", appointment.id).is("payment_intent_id", null);
    throw new Error(`payment_provider_not_configured:${params.provider}`);
  }

  let intent;
  try {
    intent = await adapter.createPaymentIntent({
      appointmentId: appointment.id,
      amount,
      currency,
      customerEmail: appointment.customer_email,
      customerPhone: appointment.customer_phone,
      returnUrl: params.returnUrl,
      idempotencyKey: params.idempotencyKey,
    });
  } catch (error) {
    await supabaseAdmin.from("service_payment_idempotency").update({ processing_until: null })
      .eq("customer_user_id", params.customerUserId).eq("provider", params.provider)
      .eq("idempotency_key", params.idempotencyKey).eq("appointment_id", appointment.id).is("payment_intent_id", null);
    throw error;
  }

  const { error: intentPersistError } = await supabaseAdmin.from("service_payment_idempotency").update({
    payment_intent_id: intent.id,
    provider_reference: intent.providerReference,
    processing_until: null,
  }).eq("customer_user_id", params.customerUserId)
    .eq("provider", params.provider)
    .eq("idempotency_key", params.idempotencyKey)
    .eq("appointment_id", appointment.id)
    .is("payment_intent_id", null);
  if (intentPersistError) throw new Error("Unable to persist payment idempotency record");

  // Terminal provider results must go through the same database-enforced webhook
  // lifecycle as asynchronous callbacks. This closes the race where cancellation
  // happens after provider success but before the old direct appointment update.
  if (intent.status === "succeeded") {
    await recordAndApplyPaymentWebhook({
      eventId: `${params.provider}:intent:${intent.id}:succeeded`,
      provider: params.provider,
      eventType: `${params.provider}.intent_created`,
      providerReference: intent.providerReference || intent.id,
      appointmentId: appointment.id,
      status: "succeeded",
      paidAt: new Date().toISOString(),
      refundedAmount: 0,
      rawPayload: { source: "payment_intent_creation", intentId: intent.id },
    });
  } else {
    // Non-terminal intent creation only marks the appointment pending while it
    // remains payable; cancellation wins any race with this update.
    const { error: appointmentUpdateError } = await supabaseAdmin.from("service_appointments").update({
      payment_status: "pending",
      payment_reference: intent.providerReference,
    }).eq("id", appointment.id)
      .eq("customer_user_id", params.customerUserId)
      .in("status", ["pending", "confirmed"])
      .neq("payment_status", "paid");
    if (appointmentUpdateError) throw new Error("Unable to persist appointment payment state");
  }

  return intent;
}
