import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function context() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: account } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) return null;
  const { data: profile } = await supabaseAdmin
    .from("service_profiles")
    .select("id,notification_email,notification_whatsapp")
    .eq("business_id", account.business_id)
    .maybeSingle();
  return profile ? { user, account, profile } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  return NextResponse.json({ notifications: ctx.profile });
}

export async function PATCH(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  if (["approved", "live"].includes(ctx.account.onboarding_status)) {
    return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const patch: Record<string, boolean> = {};
  if (typeof body?.notificationEmail === "boolean") patch.notification_email = body.notificationEmail;
  if (typeof body?.notificationWhatsApp === "boolean") patch.notification_whatsapp = body.notificationWhatsApp;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No notification settings supplied." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("service_profiles").update(patch).eq("id", ctx.profile.id).select("id,notification_email,notification_whatsapp").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data });
}
