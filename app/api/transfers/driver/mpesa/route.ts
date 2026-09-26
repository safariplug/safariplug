import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { initiateMpesaStkPush } from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const requestId = String(body.requestId || "").trim();
    const phone = String(body.phone || "").trim();
    if (!requestId || !phone) return NextResponse.json({ error: "Transfer request and M-Pesa phone are required." }, { status: 400 });

    const { data: transfer, error: transferError } = await supabaseAdmin
      .from("driver_transfer_requests")
      .select("id,traveler_id,status,quoted_amount,currency,payment_status,payment_reference")
      .eq("id", requestId)
      .eq("traveler_id", user.id)
      .maybeSingle();

    if (transferError) throw transferError;
    if (!transfer) return NextResponse.json({ error: "Transfer request not found." }, { status: 404 });
    if (transfer.status !== "accepted") return NextResponse.json({ error: "The driver must accept the quoted transfer before payment." }, { status: 409 });
    if (transfer.payment_status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
    const amount = Number(transfer.quoted_amount);
    const currency = String(transfer.currency || "").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "This transfer does not have a payable quote." }, { status: 409 });
    if (currency !== "KES") return NextResponse.json({ error: "M-Pesa transfer payment currently supports KES only." }, { status: 409 });

    const idempotencyKey = `driver-transfer:${requestId}`;
    const { data: existing } = await supabaseAdmin
      .from("driver_transfer_payment_attempts")
      .select("id,status,provider_reference")
      .eq("traveler_id", user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.status === "succeeded") return NextResponse.json({ ok: true, alreadyPaid: true });
    if (existing && ["submitting", "processing", "uncertain"].includes(existing.status)) {
      return NextResponse.json({ error: "A transfer payment attempt is already in progress or awaiting reconciliation." }, { status: 409 });
    }

    let attemptId = existing?.id || null;
    if (attemptId) {
      const { error } = await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ status: "submitting", provider_reference: null, updated_at: new Date().toISOString() })
        .eq("id", attemptId)
        .eq("traveler_id", user.id);
      if (error) throw error;
    } else {
      const { data: attempt, error } = await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .insert({
          request_id: requestId,
          traveler_id: user.id,
          provider: "mpesa",
          idempotency_key: idempotencyKey,
          amount,
          currency,
          status: "submitting",
        })
        .select("id")
        .single();
      if (error || !attempt) {
        if (error?.code === "23505") {
          return NextResponse.json({ error: "A transfer payment attempt is already in progress." }, { status: 409 });
        }
        throw error || new Error("Unable to reserve transfer payment.");
      }
      attemptId = attempt.id;
    }

    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.safariplug.com").replace(/\/$/, "");
    try {
      const result = await initiateMpesaStkPush({
        amount,
        phone,
        accountReference: `SPTR-${requestId.slice(0, 8)}`,
        transactionDescription: "SafariPlug transfer",
        callbackUrl: `${appUrl}/api/transfers/driver/mpesa/callback`,
      });

      const now = new Date().toISOString();
      const { error: attemptError } = await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ provider_reference: result.checkoutRequestId, status: "processing", updated_at: now })
        .eq("id", attemptId);
      if (attemptError) throw attemptError;

      const { error: transferUpdateError } = await supabaseAdmin
        .from("driver_transfer_requests")
        .update({ payment_status: "pending", payment_reference: result.checkoutRequestId, updated_at: now })
        .eq("id", requestId)
        .eq("traveler_id", user.id)
        .eq("status", "accepted")
        .neq("payment_status", "paid");
      if (transferUpdateError) throw transferUpdateError;

      return NextResponse.json({ ok: true, processing: true, message: result.customerMessage || "Check your phone to complete the M-Pesa payment." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const uncertain = message === "mpesa_submission_uncertain" || message === "mpesa_stk_response_uncertain";
      await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ status: uncertain ? "uncertain" : "failed", updated_at: new Date().toISOString() })
        .eq("id", attemptId);
      if (!uncertain) {
        await supabaseAdmin
          .from("driver_transfer_requests")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", requestId)
          .eq("traveler_id", user.id)
          .neq("payment_status", "paid");
      }
      return NextResponse.json(
        { error: uncertain ? "Payment submission is uncertain. Do not retry until SafariPlug reconciles it." : "Unable to start M-Pesa payment." },
        { status: uncertain ? 409 : 502 },
      );
    }
  } catch (error) {
    console.error("Driver transfer M-Pesa initiation error", error);
    return NextResponse.json({ error: "Unable to start transfer payment." }, { status: 500 });
  }
}
