import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const [partnersResult, invitationsResult, suppliersResult] = await Promise.all([
      supabaseAdmin.from("safari_partners").select("id,venue_or_promoter_name,contact_person,email_or_phone,instagram_handle,outreach_stage,notes,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("partner_invitations").select("id,business_name,partner_type,status,contact_email,whatsapp_phone,created_at,opened_at,signup_started_at,onboarded_user_id").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("supplier_accounts").select("id,business_id,contact_name,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,businesses!inner(id,name,email,phone,status,service_profiles(id,status,booking_status,service_categories(name,slug),service_offerings(id,status)))").order("created_at", { ascending: false }).limit(50),
    ]);
    const error = partnersResult.error || invitationsResult.error || suppliersResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ partners: partnersResult.data ?? [], invitations: invitationsResult.data ?? [], suppliers: suppliersResult.data ?? [] });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load Partner CRM operations." }, { status: 500 });
  }
}
