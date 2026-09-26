import { NextResponse } from "next/server";
import { requireFinanceAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireFinanceAdmin();
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "admin_verification_failed" },
      { status },
    );
  }

  const body = await request.json().catch(() => null) as {
    action?: string;
    payoutId?: string;
    reason?: string;
    notes?: string;
    reference?: string;
  } | null;

  const action = String(body?.action || "");

  if (action === "sweep_stale") {
    const { data, error } = await supabaseAdmin.rpc("reconcile_service_provider_payouts");
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, movedToHeld: Number(data || 0) });
  }

  if (!body?.payoutId) return NextResponse.json({ error: "payout_id_required" }, { status: 400 });

  if (action === "approve" || action === "hold") {
    const rpc = action === "approve" ? "approve_service_provider_payout_as_admin" : "hold_service_provider_payout";
    const args = action === "approve"
      ? { p_payout_id: body.payoutId, p_admin_user_id: user.id }
      : { p_payout_id: body.payoutId, p_reason: body.reason?.trim() || "Admin review hold" };
    const { data, error } = await supabaseAdmin.rpc(rpc, args);
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, payout: data, adminUserId: user.id });
  }

  if (action === "reconcile_paid" || action === "reconcile_failed") {
    const notes = String(body.notes || "").trim();
    const reference = String(body.reference || "").trim();
    if (!notes) return NextResponse.json({ error: "reconciliation_notes_required" }, { status: 400 });
    if (action === "reconcile_paid" && !reference) {
      return NextResponse.json({ error: "payout_reference_required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("reconcile_service_provider_payout_as_admin", {
      p_payout_id: body.payoutId,
      p_admin_user_id: user.id,
      p_outcome: action === "reconcile_paid" ? "confirm_paid" : "confirm_failed",
      p_reference: reference || null,
      p_notes: notes,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, payout: data, adminUserId: user.id });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
