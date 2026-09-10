import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initiateMpesaStkPush } from "@/lib/payments/mpesa";

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

  const { data: ledger, error } = await supabase.from("hotel_booking_pricing_ledger").select("*").eq("id", ledgerId).eq("customer_user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ledger) return NextResponse.json({ error: "Hotel payment record not found." }, { status: 404 });
  if (String(ledger.customer_currency || ledger.currency).toUpperCase() !== "KES") return NextResponse.json({ error: "M-Pesa hotel payments require KES pricing." }, { status: 409 });
  if (["paid", "refunded", "cancelled"].includes(String(ledger.payment_status))) return NextResponse.json({ error: `Payment is already ${ledger.payment_status}.` }, { status: 409 });

  try {
    const result = await initiateMpesaStkPush({ amount: Number(ledger.customer_retail_amount ?? ledger.retail_amount), phone, accountReference: `SPH-${ledger.id.slice(0, 8)}`, transactionDescription: "SafariPlug hotel" });
    const metadata = ledger.metadata && typeof ledger.metadata === "object" && !Array.isArray(ledger.metadata) ? ledger.metadata : {};
    const { data: updated, error: updateError } = await supabase.from("hotel_booking_pricing_ledger").update({ payment_provider: "mpesa", payment_reference: result.checkoutRequestId, payment_status: "pending", booking_status: "payment_pending", metadata: { ...metadata, mpesaCheckoutRequestId: result.checkoutRequestId, mpesaMerchantRequestId: result.merchantRequestId, customerPhoneLast4: phone.replace(/\D/g, "").slice(-4), paymentInitiatedAt: new Date().toISOString() } }).eq("id", ledger.id).eq("customer_user_id", user.id).select("id,customer_retail_amount,customer_currency,payment_provider,payment_reference,payment_status,booking_status").single();
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ provider: "mpesa", status: "processing", checkoutRequestId: result.checkoutRequestId, customerMessage: result.customerMessage, ledger: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "M-Pesa payment request failed." }, { status: 502 });
  }
}
