import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";
import type { PaymentProvider } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<PaymentProvider>(["stripe", "mpesa", "paystack", "flutterwave", "manual"]);

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as {
      appointmentId?: string;
      provider?: string;
      providerReference?: string;
    } | null;
    const appointmentId = String(body?.appointmentId || "");
    const provider = String(body?.provider || "") as PaymentProvider;
    const providerReference = String(body?.providerReference || "");
    if (!appointmentId || !PROVIDERS.has(provider) || !providerReference) {
      return NextResponse.json({ error: "appointmentId, provider and providerReference are required." }, { status: 400 });
    }

    const { data: appointment } = await client
      .from("service_appointments")
      .select("id,payment_status,customer_user_id")
      .eq("id", appointmentId)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    const { data: intent } = await supabaseAdmin
      .from("service_payment_idempotency")
      .select("appointment_id,provider,provider_reference")
      .eq("appointment_id", appointmentId)
      .eq("customer_user_id", user.id)
      .eq("provider", provider)
      .eq("provider_reference", providerReference)
      .maybeSingle();
    if (!intent) return NextResponse.json({ error: "Payment intent not found." }, { status: 404 });

    if (appointment.payment_status === "paid") {
      return NextResponse.json({ status: "succeeded", paymentStatus: "paid" });
    }

    const adapter = getPaymentAdapter(provider);
    if (!adapter) return NextResponse.json({ error: `payment_provider_not_configured:${provider}` }, { status: 503 });

    const status = await adapter.getPaymentStatus(providerReference);
    if (status === "succeeded" || status === "failed" || status === "cancelled") {
      await recordAndApplyPaymentWebhook({
        eventId: `${provider}:status:${providerReference}:${status}`,
        provider,
        eventType: `${provider}.status_reconciled`,
        providerReference,
        appointmentId,
        status,
        paidAt: status === "succeeded" ? new Date().toISOString() : null,
        refundedAmount: 0,
        rawPayload: { source: "status_reconciliation", providerReference, status },
      });
    }

    return NextResponse.json({ status, paymentStatus: status === "succeeded" ? "paid" : status === "failed" || status === "cancelled" ? status : "pending" });
  } catch (error) {
    console.error("Payment status reconciliation error", error);
    const message = error instanceof Error ? error.message : "Unable to check payment status.";
    const status = message.includes("not_configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
