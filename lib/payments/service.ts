import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "./registry";
import type { PaymentProvider } from "./types";

export async function createServicePaymentIntent(params: {
  appointmentId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  returnUrl?: string | null;
}) {
  const { data: appointment, error } = await supabaseAdmin
    .from("service_appointments")
    .select("id,customer_email,customer_phone,price,currency,payment_status,status")
    .eq("id", params.appointmentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load appointment");
  if (!appointment) throw new Error("appointment_not_found");
  if (["cancelled", "no_show"].includes(appointment.status)) throw new Error("appointment_not_payable");
  if (appointment.payment_status === "paid") throw new Error("appointment_already_paid");

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

  await supabaseAdmin.from("service_appointments").update({
    payment_status: intent.status === "succeeded" ? "paid" : "pending",
    payment_reference: intent.providerReference,
    paid_at: intent.status === "succeeded" ? new Date().toISOString() : null,
  }).eq("id", appointment.id);

  return intent;
}
