import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const [prospectsResult, partnersResult, invitationsResult, suppliersResult, followupsResult, schedulerResult] = await Promise.all([
      supabaseAdmin.from("ai_sales_prospects").select("id,business_name,category,city,status,review_status,contact_email,phone,created_at").eq("review_status", "approved").neq("status", "rejected").order("updated_at", { ascending: false }).limit(500),
      supabaseAdmin.from("safari_partners").select("id,venue_or_promoter_name,contact_person,email_or_phone,instagram_handle,outreach_stage,notes,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("partner_invitations").select("id,business_name,partner_type,status,contact_email,whatsapp_phone,prospect_id,created_at,opened_at,signup_started_at,onboarded_user_id").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("supplier_accounts").select("id,business_id,contact_name,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,businesses!inner(id,name,email,phone,status,service_profiles(id,status,booking_status,service_categories(name,slug),service_offerings(id,status)))").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("supplier_onboarding_followups").select("id,supplier_id,subject,sent_at,next_followup_due_at,status").eq("status","sent").order("sent_at",{ascending:false}).limit(200),
      supabaseAdmin.from("supplier_followup_prep_runs").select("status,checked_count,prepared_count,skipped_count,error_message,started_at,completed_at").order("completed_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    const error = prospectsResult.error || partnersResult.error || invitationsResult.error || suppliersResult.error || followupsResult.error || schedulerResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const latestBySupplier = new Map<string, unknown>();
    for (const row of followupsResult.data ?? []) {
      if (!latestBySupplier.has(row.supplier_id)) latestBySupplier.set(row.supplier_id, row);
    }
    const suppliers = (suppliersResult.data ?? []).map((supplier) => ({
      ...supplier,
      latest_followup: latestBySupplier.get(supplier.id) || null,
    }));
    return NextResponse.json({ prospects: prospectsResult.data ?? [], partners: partnersResult.data ?? [], invitations: invitationsResult.data ?? [], suppliers, scheduler: schedulerResult.data ?? null });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load Partner CRM operations." }, { status: 500 });
  }
}
