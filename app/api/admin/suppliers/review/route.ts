import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";

const ALLOWED_REVIEW_ITEMS = new Set([
  "business_details",
  "business_images",
  "services_pricing",
  "team",
  "personal_photos",
  "availability",
  "staff_verification",
  "verification",
  "payout_details",
  "other",
]);

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await supabaseAdmin
      .from("supplier_accounts")
      .select("id,business_id,contact_name,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,created_at,review_items,review_note,review_requested_at,businesses!inner(id,name,description,phone,email,city_id,status,logo_url,cover_image_url,service_profiles(id,status,booking_status,service_categories(name,slug),service_offerings(id,name,price,currency,status,duration_minutes),service_staff(id,display_name,personal_photo_url,status)))")
      .in("onboarding_status", ["draft", "onboarding", "submitted", "changes_requested", "approved", "rejected", "live"])
      .order("created_at", { ascending: false });
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
    const body = await request.json().catch(() => null) as {
      supplierId?: string;
      action?: string;
      reviewItems?: string[];
      reviewNote?: string;
    } | null;
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
      const readiness = await getSupplierActivationReadiness(supplierId);
      if (!readiness.ready) {
        return NextResponse.json({
          error: "Supplier cannot be approved until all activation requirements are complete.",
          missing: readiness.issues,
          checks: readiness.checks,
        }, { status: 422 });
      }
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("supplier_accounts").update({
        onboarding_status: "approved",
        approved_at: now,
        review_items: [],
        review_note: null,
        review_requested_at: null,
        updated_at: now,
      }).eq("id", supplierId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { error: businessError } = await supabaseAdmin.from("businesses").update({ status: "active" }).eq("id", account.business_id);
      if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });

      const { data: profile, error: profileError } = await supabaseAdmin.from("service_profiles")
        .update({ status: "active", booking_status: "open" })
        .eq("business_id", account.business_id)
        .select("id")
        .maybeSingle();
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

      if (profile) {
        const { error: offeringError } = await supabaseAdmin.from("service_offerings").update({ status: "active" }).eq("service_profile_id", profile.id).eq("status", "draft");
        if (offeringError) return NextResponse.json({ error: offeringError.message }, { status: 500 });
        const { data: offerings } = await supabaseAdmin.from("service_offerings").select("id").eq("service_profile_id", profile.id).eq("status", "active");
        const { data: staff } = await supabaseAdmin.from("service_staff").select("id").eq("service_profile_id", profile.id).eq("status", "active");
        if (offerings?.length && staff?.length) {
          const assignments = staff.flatMap((member) => offerings.map((offering) => ({ staff_id: member.id, offering_id: offering.id })));
          const { error: assignmentError } = await supabaseAdmin.from("service_staff_offerings").upsert(assignments, { onConflict: "staff_id,offering_id" });
          if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true, onboarding_status: "approved" });
    }

    if (action === "request_changes") {
      const reviewItems = Array.from(new Set((Array.isArray(body?.reviewItems) ? body.reviewItems : [])
        .map((item) => String(item || "").trim())
        .filter((item) => ALLOWED_REVIEW_ITEMS.has(item))));
      const reviewNote = String(body?.reviewNote || "").trim().slice(0, 2000);
      if (!reviewItems.length && !reviewNote) {
        return NextResponse.json({ error: "Choose at least one requested fix or add a review note." }, { status: 400 });
      }
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("supplier_accounts").update({
        onboarding_status: "changes_requested",
        review_items: reviewItems,
        review_note: reviewNote || null,
        review_requested_at: now,
        updated_at: now,
      }).eq("id", supplierId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, onboarding_status: "changes_requested", review_items: reviewItems });
    }

    const { error } = await supabaseAdmin.from("supplier_accounts").update({
      onboarding_status: "rejected",
      updated_at: new Date().toISOString(),
    }).eq("id", supplierId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("businesses").update({ status: "inactive" }).eq("id", account.business_id);
    return NextResponse.json({ success: true, onboarding_status: "rejected" });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to update supplier review." }, { status: 500 });
  }
}
