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
    const suppliers = await Promise.all((data ?? []).map(async (supplier) => {
      try {
        const activation_readiness = await getSupplierActivationReadiness(supplier.id);
        return { ...supplier, activation_readiness };
      } catch {
        return { ...supplier, activation_readiness: null };
      }
    }));
    return NextResponse.json({ suppliers });
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
      .select("id,user_id,business_id,prospect_id,partner_id,onboarding_status")
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
      const { error: activationError } = await supabaseAdmin.rpc("activate_supplier_after_review", {
        p_supplier_id: supplierId,
      });
      if (activationError) {
        return NextResponse.json({ error: activationError.message || "Unable to activate supplier." }, { status: 500 });
      }

      const now = new Date().toISOString();
      const { error: invitationError } = await supabaseAdmin
        .from("partner_invitations")
        .update({ status: "active", updated_at: now })
        .eq("onboarded_user_id", account.user_id)
        .eq("status", "onboarding");
      if (invitationError) {
        return NextResponse.json({
          error: "Supplier was activated, but the recruitment invitation could not be advanced to active. Review CRM state before continuing.",
        }, { status: 500 });
      }

      if (account.prospect_id || account.partner_id) {
        const { error: activityError } = await supabaseAdmin.from("crm_activities").insert({
          prospect_id: account.prospect_id || null,
          partner_id: account.partner_id || null,
          activity_type: "status_change",
          summary: "Supplier approved and activated",
          details: `Supplier account ${account.id} passed activation review and its linked recruitment invitation was advanced to active.`,
        });
        if (activityError) {
          return NextResponse.json({
            error: "Supplier was activated, but CRM activity logging failed. Review CRM state before continuing.",
          }, { status: 500 });
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

    const rejectedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("supplier_accounts").update({
      onboarding_status: "rejected",
      updated_at: rejectedAt,
    }).eq("id", supplierId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: businessError } = await supabaseAdmin.from("businesses").update({ status: "inactive" }).eq("id", account.business_id);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });

    const { error: invitationError } = await supabaseAdmin
      .from("partner_invitations")
      .update({ status: "declined", updated_at: rejectedAt })
      .eq("onboarded_user_id", account.user_id)
      .in("status", ["signup_started", "onboarding"]);
    if (invitationError) {
      return NextResponse.json({
        error: "Supplier was rejected, but the recruitment invitation could not be marked declined.",
      }, { status: 500 });
    }

    if (account.prospect_id || account.partner_id) {
      const { error: activityError } = await supabaseAdmin.from("crm_activities").insert({
        prospect_id: account.prospect_id || null,
        partner_id: account.partner_id || null,
        activity_type: "status_change",
        summary: "Supplier onboarding rejected",
        details: `Supplier account ${account.id} was rejected during SafariPlug review.`,
      });
      if (activityError) {
        return NextResponse.json({
          error: "Supplier was rejected, but CRM activity logging failed.",
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, onboarding_status: "rejected" });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to update supplier review." }, { status: 500 });
  }
}
