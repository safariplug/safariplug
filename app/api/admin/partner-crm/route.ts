import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supplierPerformanceScore } from "@/lib/services/supplier-performance-scorecard";

export async function GET() {
  try {
    await requireAdmin();
    const [prospectsResult, partnersResult, invitationsResult, suppliersResult, followupsResult, schedulerResult, appointmentsResult, payoutsResult, qualityTasksResult] = await Promise.all([
      supabaseAdmin.from("ai_sales_prospects").select("id,business_name,category,city,status,review_status,contact_email,phone,created_at").eq("review_status", "approved").neq("status", "rejected").order("updated_at", { ascending: false }).limit(500),
      supabaseAdmin.from("safari_partners").select("id,venue_or_promoter_name,contact_person,email_or_phone,instagram_handle,outreach_stage,notes,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("partner_invitations").select("id,business_name,partner_type,status,contact_email,whatsapp_phone,prospect_id,created_at,opened_at,signup_started_at,onboarded_user_id").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("supplier_accounts").select("id,user_id,business_id,prospect_id,contact_name,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,businesses!inner(id,name,email,phone,status,service_profiles(id,status,booking_status,service_categories(name,slug),service_offerings(id,status),service_staff(id,status,service_staff_availability(id,is_active))))").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("supplier_onboarding_followups").select("id,supplier_id,subject,sent_at,next_followup_due_at,status").eq("status","sent").order("sent_at",{ascending:false}).limit(200),
      supabaseAdmin.from("supplier_followup_prep_runs").select("status,checked_count,prepared_count,skipped_count,error_message,started_at,completed_at").order("completed_at",{ascending:false}).limit(1).maybeSingle(),
      supabaseAdmin.from("service_appointments").select("id,service_profile_id,status,created_at").gte("created_at", new Date(Date.now()-30*24*60*60*1000).toISOString()).limit(5000),
      supabaseAdmin.from("service_provider_payouts").select("id,provider_user_id,status,updated_at").in("status",["held","failed","processing"]).gte("updated_at", new Date(Date.now()-30*24*60*60*1000).toISOString()).limit(1000),
      supabaseAdmin.from("crm_followups").select("id,prospect_id,title,status").eq("status","open").ilike("title","[Supplier quality]%").limit(2000),
    ]);
    const error = prospectsResult.error || partnersResult.error || invitationsResult.error || suppliersResult.error || followupsResult.error || schedulerResult.error || appointmentsResult.error || payoutsResult.error || qualityTasksResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const latestBySupplier = new Map<string, unknown>();
    for (const row of followupsResult.data ?? []) {
      if (!latestBySupplier.has(row.supplier_id)) latestBySupplier.set(row.supplier_id, row);
    }
    const appointmentStatsByProfile = new Map<string,{bookings:number;completed:number;cancelled:number;noShow:number}>();
    for (const row of appointmentsResult.data ?? []) {
      const key = String((row as any).service_profile_id || "");
      if (!key) continue;
      const current = appointmentStatsByProfile.get(key) || { bookings:0, completed:0, cancelled:0, noShow:0 };
      current.bookings += 1;
      if ((row as any).status === "completed") current.completed += 1;
      if ((row as any).status === "cancelled") current.cancelled += 1;
      if ((row as any).status === "no_show") current.noShow += 1;
      appointmentStatsByProfile.set(key,current);
    }

    const payoutIssuesByUser = new Map<string,number>();
    for (const row of payoutsResult.data ?? []) {
      const key = String((row as any).provider_user_id || "");
      if (key) payoutIssuesByUser.set(key,(payoutIssuesByUser.get(key)||0)+1);
    }

    const qualityIssuesByProspect = new Map<string,number>();
    for (const row of qualityTasksResult.data ?? []) {
      const key = String((row as any).prospect_id || "");
      if (key) qualityIssuesByProspect.set(key,(qualityIssuesByProspect.get(key)||0)+1);
    }

    const suppliers = (suppliersResult.data ?? []).map((supplier:any) => {
      const business = supplier.businesses;
      const profiles = Array.isArray(business?.service_profiles) ? business.service_profiles : business?.service_profiles ? [business.service_profiles] : [];
      const profileStats = profiles.reduce((acc:any, profile:any) => {
        const stats = appointmentStatsByProfile.get(String(profile.id)) || {bookings:0,completed:0,cancelled:0,noShow:0};
        acc.bookings += stats.bookings;
        acc.completed += stats.completed;
        acc.cancelled += stats.cancelled;
        acc.noShow += stats.noShow;
        return acc;
      },{bookings:0,completed:0,cancelled:0,noShow:0});
      const allOpen = profiles.length > 0 && profiles.every((profile:any)=>profile.status==="active"&&profile.booking_status==="open");
      const activeAvailability = profiles.flatMap((profile:any)=>Array.isArray(profile.service_staff)?profile.service_staff:profile.service_staff?[profile.service_staff]:[])
        .filter((member:any)=>member.status==="active")
        .flatMap((member:any)=>Array.isArray(member.service_staff_availability)?member.service_staff_availability:member.service_staff_availability?[member.service_staff_availability]:[])
        .filter((slot:any)=>slot.is_active===true).length;
      const payoutIssues = payoutIssuesByUser.get(String(supplier.user_id||"")) || 0;
      const qualityIssues = qualityIssuesByProspect.get(String(supplier.prospect_id||"")) || 0;
      const performance = supplierPerformanceScore({
        bookingStatusOpen: allOpen,
        activeAvailabilityCount: activeAvailability,
        payoutAccountVerified: payoutIssues===0,
        payoutIssueCount: payoutIssues,
        completed: profileStats.completed,
        cancelled: profileStats.cancelled,
        noShow: profileStats.noShow,
        openQualityIssues: qualityIssues,
      });
      const growthOpportunity = ["approved","live"].includes(String(supplier.onboarding_status||"")) && allOpen && activeAvailability>0 && profileStats.bookings===0;
      const inactiveInventory = ["approved","live"].includes(String(supplier.onboarding_status||"")) && (!allOpen || activeAvailability===0);
      return {
        ...supplier,
        latest_followup: latestBySupplier.get(supplier.id) || null,
        performance: {
          ...performance,
          bookings30d: profileStats.bookings,
          completed30d: profileStats.completed,
          cancelled30d: profileStats.cancelled,
          noShow30d: profileStats.noShow,
          activeAvailability,
          payoutIssues,
          openQualityIssues: qualityIssues,
          growthOpportunity,
          inactiveInventory,
        },
      };
    });

    const portfolio = suppliers
      .filter((supplier:any)=>["approved","live"].includes(String(supplier.onboarding_status||"")))
      .sort((a:any,b:any)=>(b.performance?.score||0)-(a.performance?.score||0));

    return NextResponse.json({
      prospects: prospectsResult.data ?? [],
      partners: partnersResult.data ?? [],
      invitations: invitationsResult.data ?? [],
      suppliers,
      scheduler: schedulerResult.data ?? null,
      portfolio: {
        strongest: portfolio.slice(0,5),
        atRisk: [...portfolio].sort((a:any,b:any)=>(a.performance?.score||0)-(b.performance?.score||0)).slice(0,5),
        inactiveInventory: portfolio.filter((supplier:any)=>supplier.performance?.inactiveInventory),
        growthOpportunities: portfolio.filter((supplier:any)=>supplier.performance?.growthOpportunity),
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load Partner CRM operations." }, { status: 500 });
  }
}
