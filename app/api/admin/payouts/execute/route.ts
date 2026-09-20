import { NextResponse } from "next/server";
import { AdminAuthError, requireFinanceAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createMpesaB2CPayout, isMpesaPayoutSubmissionUncertain } from "@/lib/payments/mpesa-payout";

export const dynamic = "force-dynamic";

type ClaimedPayout = { id: string; payout_destination_phone: string; provider_net_amount: number | string };

export async function POST(request: Request) {
  try {
    await requireFinanceAdmin();
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "admin_verification_failed" },
      { status },
    );
  }

  const body = await request.json().catch(() => null) as { payoutId?: string } | null;
  if (!body?.payoutId) return NextResponse.json({ error: "payout_id_required" }, { status: 400 });

  const { data: rawPayout, error: claimError } = await supabaseAdmin
    .rpc("claim_service_provider_payout", { p_payout_id: body.payoutId })
    .single();
  const payout = rawPayout as unknown as ClaimedPayout | null;

  if (claimError || !payout) {
    return NextResponse.json({ error: claimError?.message || "payout_not_ready" }, { status: 409 });
  }

  let result;
  try {
    result = await createMpesaB2CPayout({
      payoutId: payout.id,
      phone: payout.payout_destination_phone,
      amount: Number(payout.provider_net_amount),
      remarks: `SafariPlug provider payout ${String(payout.id).slice(0, 12)}`,
      occasion: "SafariPlug provider payout",
    });
  } catch (error) {
    console.error("M-Pesa B2C payout submission error", error);

    if (isMpesaPayoutSubmissionUncertain(error)) {
      const reason = error instanceof Error ? error.message.slice(0, 500) : "mpesa_b2c_submission_outcome_uncertain";
      const { error: reconciliationError } = await supabaseAdmin
        .from("service_provider_payouts")
        .update({
          payout_provider: "mpesa_b2c",
          failure_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout.id)
        .eq("status", "processing");

      if (reconciliationError) {
        console.error("Failed to persist uncertain payout state", reconciliationError);
      }

      return NextResponse.json(
        {
          error: "payout_processing_reconciliation_required",
          retryAllowed: false,
          status: "processing",
        },
        { status: 502 },
      );
    }

    const { error: holdError } = await supabaseAdmin
      .from("service_provider_payouts")
      .update({
        status: "held",
        failure_reason: error instanceof Error ? error.message.slice(0, 500) : "mpesa_b2c_execution_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)
      .eq("status", "processing");

    if (holdError) {
      console.error("Failed to hold payout after confirmed pre-submission/rejection error", holdError);
      return NextResponse.json(
        { error: "payout_state_update_failed", retryAllowed: false, status: "processing" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "payout_held_after_confirmed_submission_failure", retryAllowed: false, status: "held" },
      { status: 502 },
    );
  }

  const acceptedUpdate = {
    payout_provider: "mpesa_b2c",
    mpesa_conversation_id: result.providerReference,
    payout_reference: result.providerReference,
    failure_reason: null,
    updated_at: new Date().toISOString(),
    metadata: { b2c_request: result.raw },
  };

  const { error: persistenceError } = await supabaseAdmin
    .from("service_provider_payouts")
    .update(acceptedUpdate)
    .eq("id", payout.id)
    .eq("status", "processing");

  if (persistenceError) {
    console.error("M-Pesa accepted payout but reference persistence failed", persistenceError);

    const { error: fallbackError } = await supabaseAdmin
      .from("service_provider_payouts")
      .update({
        ...acceptedUpdate,
        failure_reason: `provider_accepted_reference_persistence_retried:${persistenceError.message.slice(0, 300)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)
      .eq("status", "processing");

    if (fallbackError) {
      console.error("Critical: accepted payout reference could not be persisted", fallbackError);
      return NextResponse.json(
        {
          error: "payout_processing_reference_persistence_failed",
          retryAllowed: false,
          status: "processing",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, status: "processing", conversationId: result.providerReference });
}
