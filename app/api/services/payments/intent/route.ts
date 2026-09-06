import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createServicePaymentIntent } from "@/lib/payments/service";
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

    const body = await request.json();
    const appointmentId = String(body.appointmentId || "");
    const provider = String(body.provider || "") as PaymentProvider;
    const idempotencyKey = String(body.idempotencyKey || "");
    if (!appointmentId || !PROVIDERS.has(provider) || !idempotencyKey) {
      return NextResponse.json({ error: "appointmentId, provider and idempotencyKey are required." }, { status: 400 });
    }

    const { data: appointment } = await client.from("service_appointments").select("id").eq("id", appointmentId).eq("customer_user_id", user.id).maybeSingle();
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    const intent = await createServicePaymentIntent({ appointmentId, provider, idempotencyKey, returnUrl: body.returnUrl || null });
    return NextResponse.json({ intent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment.";
    const status = message.includes("not_configured") ? 503 : message.includes("not_found") ? 404 : message.includes("already_paid") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
