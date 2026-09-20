import { NextResponse } from "next/server";
import { AdminAuthError, requireFinanceAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createMpesaB2CPayout } from "@/lib/payments/mpesa-payout";

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

  try {
    const result = await createMpesaB2CPayout({
      payoutId: payout.id,
      phone: payout.payout_destination_phone,
      amount: Number(payout.provider_net_amount),
      remarks: `SafariPlug provider payout ${String(payout.id).slice(0, 12)}`,
      occasion: "SafariPlug provider payout",
    });

    const { error } = await supabaseAdmin.from("service_provider_payouts").update({
      payout_provider: "mpesa_b2c",
      mpesa_conversation_id: result.providerReference,
      payout_reference: result.providerReference,
      updated_at: new Date().toISOString(),
      metadata: { b2c_request: result.raw },
    }).eq("id", payout.id).eq("status", "processing");

    if (error) throw error;
    return NextResponse.json({ ok: true, status: "processing", conversationId: result.providerReference });
  } catch (error) {
    console.error("M-Pesa B2C payout execution error", error);
    await supabaseAdmin.from("service_provider_payouts").update({
      status: "held",
      failure_reason: error instanceof Error ? error.message.slice(0, 500) : "mpesa_b2c_execution_failed",
      updated_at: new Date().toISOString(),
    }).eq("id", payout.id).eq("status", "processing");
    return NextResponse.json({ error: "payout_held_after_execution_error" }, { status: 502 });
  }
}
