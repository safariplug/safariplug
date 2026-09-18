import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { initiateMpesaStkPush } from "@/lib/payments/mpesa";
import { hotelPaymentSafeToRetry } from "@/lib/integrations/hotels/hotel-payment-safety";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const ledgerId = String(body.ledgerId || "");
  const phone = String(body.phone || "");
  if (!ledgerId || !phone) return NextResponse.json({ error: "ledgerId and phone are required." }, { status: 400 });

  const { data: ledger, error } = await supabaseAdmin.from("hotel_booking_pricing_ledger").select("*").eq("id", ledgerId).eq("customer_user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ledger) return NextResponse.json({ error: "Hotel payment record not found." }, { status: 404 });
  if (String(ledger.customer_currency || ledger.currency).toUpperCase() !== "KES") return NextResponse.json({ error: "M-Pesa hotel payments require KES pricing." }, { status: 409 });
  if (["paid", "refunded", "cancelled"].includes(String(ledger.payment_status))) return NextResponse.json({ error: `Payment is already ${ledger.payment_status}.` }, { status: 409 });

  if (ledger.payment_reference && ledger.payment_status === "pending") {
    return NextResponse.json({
      provider: "mpesa",
      status: "processing",
      checkoutRequestId: ledger.payment_reference,
      paymentReused: true,
    });
  }

  const paymentStartedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("hotel_booking_pricing_ledger")
    .update({
      payment_status: "pending",
      payment_initiation_started_at: paymentStartedAt,
    })
    .eq("id", ledger.id)
    .eq("customer_user_id", user.id)
    .is("payment_reference", null)
    .is("payment_initiation_started_at", null)
    .select("*")
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claimed) {
    return NextResponse.json({
      provider: "mpesa",
      status: "payment_initializing",
      paymentReused: true,
      message: "A payment request is already being initialized for this hotel checkout.",
    });
  }

  try {
    const result = await initiateMpesaStkPush({
      amount: Number(ledger.customer_retail_amount ?? ledger.retail_amount),
      phone,
      accountReference: `SPH-${ledger.id.slice(0, 8)}`,
      transactionDescription: "SafariPlug hotel",
    });
    const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .update({
        payment_provider: "mpesa",
        payment_reference: result.checkoutRequestId,
        payment_status: "pending",
        booking_status: "payment_pending",
        metadata: {
          ...metadata,
          mpesaCheckoutRequestId: result.checkoutRequestId,
          mpesaMerchantRequestId: result.merchantRequestId,
          customerPhoneLast4: phone.replace(/\D/g, "").slice(-4),
          paymentInitiatedAt: paymentStartedAt,
        },
      })
      .eq("id", ledger.id)
      .eq("customer_user_id", user.id)
      .select("id,customer_retail_amount,customer_currency,payment_provider,payment_reference,payment_status,booking_status")
      .single();
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({
      provider: "mpesa",
      status: "processing",
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
      ledger: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "M-Pesa payment request failed.";
    if (hotelPaymentSafeToRetry(error)) {
      await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          payment_status: "unpaid",
          payment_initiation_started_at: null,
        })
        .eq("id", ledger.id)
        .eq("customer_user_id", user.id);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({
      error: "payment_initiation_indeterminate",
      message:
        "SafariPlug could not prove whether the M-Pesa request was created. It will not submit another payment request automatically because that could cause a duplicate charge.",
      reconciliation: "manual_required",
    }, { status: 502 });
  }
}
