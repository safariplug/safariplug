import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await supabaseAdmin
      .from("supplier_accounts")
      .select("id,business_id,contact_name,email:user_id,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,businesses!inner(id,name,description,phone,email,city_id,status),service_profiles(id,status,booking_status,service_categories(name,slug),service_offerings(id,name,price,currency,status,duration_minutes))")
      .in("onboarding_status", ["submitted", "changes_requested", "approved", "rejected", "live"])
      .order("submitted_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ suppliers: data ?? [] });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load supplier reviews." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { supplierId?: string; action?: string } | null;
    const supplierId = String(body?.supplierId || "");
    const action = String(body?.action || "");
    if (!supplierId || !["approve", "request_changes", "reject"].includes(action)) {
      return NextResponse.json({ error: "Supplier and valid review action are required." }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("supplier_accounts")
      .select("id,business_id,onboarding_status")
      .eq("id", supplierId)
      .maybeSingle();
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    if (!["submitted", "changes_requested"].includes(account.onboarding_status)) {
      return NextResponse.json({ error: "This supplier is not awaiting review." }, { status: 409 });
    }

    if (action === "approve") {
      const { error } = await supabaseAdmin.from("supplier_accounts").update({ onboarding_status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", supplierId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const { error: businessError } = await supabaseAdmin.from("businesses").update({ status: "active" }).eq("id", account.business_id);
      if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
      const { error: profileError } = await supabaseAdmin.from("service_profiles").update({ status: "active", booking_status: "open" }).eq("business_id", account.business_id);
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
      const { data: profile } = await supabaseAdmin.from("service_profiles").select("id").eq("business_id", account.business_id).maybeSingle();
      if (profile) {
        const { error: offeringError } = await supabaseAdmin.from("service_offerings").update({ status: "active" }).eq("service_profile_id", profile.id).eq("status", "draft");
        if (offeringError) return NextResponse.json({ error: offeringError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, onboarding_status: "approved" });
    }

    const nextStatus = action === "request_changes" ? "changes_requested" : "rejected";
    const { error } = await supabaseAdmin.from("supplier_accounts").update({ onboarding_status: nextStatus, updated_at: new Date().toISOString() }).eq("id", supplierId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (action === "reject") await supabaseAdmin.from("businesses").update({ status: "inactive" }).eq("id", account.business_id);
    return NextResponse.json({ success: true, onboarding_status: nextStatus });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to update supplier review." }, { status: 500 });
  }
}
