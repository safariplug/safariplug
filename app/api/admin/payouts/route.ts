import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let user;
  try { user = await requireAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof AdminAuthError ? "forbidden" : "unauthorized" }, { status: error instanceof AdminAuthError ? 403 : 401 }); }
  const body = await request.json().catch(() => null) as { action?: string; payoutId?: string; reason?: string } | null;
  if (!body?.payoutId || !["approve","hold"].includes(body.action || "")) return NextResponse.json({ error:"invalid_request" },{status:400});
  const rpc = body.action === "approve" ? "approve_service_provider_payout" : "hold_service_provider_payout";
  const args = body.action === "approve" ? { p_payout_id: body.payoutId } : { p_payout_id: body.payoutId, p_reason: body.reason?.trim() || "Admin review hold" };
  const { data, error } = await supabaseAdmin.rpc(rpc,args);
  if(error) return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json({ok:true,payout:data,adminUserId:user.id});
}
