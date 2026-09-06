import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: admin } = await supabaseAdmin.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { action?: string; payoutId?: string; reason?: string } | null;
  if (!body?.payoutId || !["approve", "hold"].includes(body.action || "")) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const fn = body.action === "approve" ? "approve_service_provider_payout" : "hold_service_provider_payout";
  const args = body.action === "approve"
    ? { p_payout_id: body.payoutId, p_admin_user_id: user.id }
    : { p_payout_id: body.payoutId, p_admin_user_id: user.id, p_reason: body.reason?.trim() || "Admin review hold" };
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, payout: data });
}
