import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SERVICE_CATALOG } from "@/lib/service-catalog";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";

const FALLBACK_ID = "00000000-0000-0000-0000-000000000000";
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function supplierContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  const { data: account } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,contact_name,invitation_status,onboarding_status,completion_percent,accepted_at,review_items,review_note,review_requested_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return account ? { user, account } : null;
}

export async function GET() {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id,name,slug,description,business_type,city_id,address,latitude,longitude,phone,whatsapp,email,website_url,instagram_url,facebook_url,tiktok_url,logo_url,cover_image_url,supplier_contact_name,supplier_gallery_urls,status")
    .eq("id", ctx.account.business_id)
    .eq("owner_id", ctx.user.id)
    .single();
  const { data: profile } = await supabaseAdmin
    .from("service_profiles")
    .select("id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days,service_categories(name,slug)")
    .eq("business_id", ctx.account.business_id)
    .single();
  const { data: offerings } = await supabaseAdmin
    .from("service_offerings")
    .select("id,name,slug,description,duration_minutes,price,currency,status,requires_confirmation")
    .eq("service_profile_id", profile?.id ?? FALLBACK_ID)
    .order("created_at");
  const { data: staff } = await supabaseAdmin
    .from("service_staff")
    .select("id,display_name,bio,status,personal_photo_url")
    .eq("service_profile_id", profile?.id ?? FALLBACK_ID)
    .order("created_at");
  const staffIds = (staff ?? []).map((member) => member.id);
  const { data: availability } = staffIds.length
    ? await supabaseAdmin.from("service_staff_availability").select("id,staff_id,day_of_week,start_time,end_time,is_active").in("staff_id", staffIds).order("day_of_week").order("start_time")
    : { data: [] };
  const category = Array.isArray((profile as any)?.service_categories) ? (profile as any)?.service_categories?.[0] : (profile as any)?.service_categories;
  const suggestedOfferings = category?.slug && SERVICE_CATALOG[category.slug] ? SERVICE_CATALOG[category.slug] : [];
  const [completion, activationReadiness] = await Promise.all([
    supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id }),
    getSupplierActivationReadiness(ctx.account.id),
  ]);
  return NextResponse.json({ account: { ...ctx.account, completion_percent: completion.data ?? ctx.account.completion_percent }, business, profile: { ...(profile ?? {}), category: category ?? null }, offerings: offerings ?? [], suggestedOfferings, staff: staff ?? [], availability: availability ?? [], activationReadiness });
}

export async function PATCH(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  if (["submitted", "approved", "live", "rejected"].includes(ctx.account.onboarding_status)) return NextResponse.json({ error: ctx.account.onboarding_status === "submitted" ? "This profile is locked while SafariPlug reviews your submission." : ctx.account.onboarding_status === "rejected" ? "This supplier application is closed and cannot be edited or resubmitted." : "This profile is locked after approval." }, { status: 409 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const businessUpdate: Record<string, unknown> = {};
  for (const key of ["name","description","address","latitude","longitude","phone","whatsapp","website_url","instagram_url","facebook_url","tiktok_url","logo_url","cover_image_url","supplier_contact_name","supplier_gallery_urls"]) if (body && key in body) businessUpdate[key] = body[key];
  if (businessUpdate.name !== undefined && (typeof businessUpdate.name !== "string" || !businessUpdate.name.trim())) return NextResponse.json({ error: "Business name is required." }, { status: 400 });

  let previousBusinessContactName: string | null | undefined;
  if (businessUpdate.supplier_contact_name !== undefined) {
    if (typeof businessUpdate.supplier_contact_name !== "string" || !businessUpdate.supplier_contact_name.trim()) {
      return NextResponse.json({ error: "Contact person is required." }, { status: 400 });
    }
    businessUpdate.supplier_contact_name = businessUpdate.supplier_contact_name.trim().slice(0, 120);
    const { data: currentBusiness, error: currentBusinessError } = await supabaseAdmin
      .from("businesses")
      .select("supplier_contact_name")
      .eq("id", ctx.account.business_id)
      .eq("owner_id", ctx.user.id)
      .single();
    if (currentBusinessError) return NextResponse.json({ error: currentBusinessError.message }, { status: 500 });
    previousBusinessContactName = currentBusiness.supplier_contact_name;
  }
  for (const key of ["latitude", "longitude"] as const) {
    if (businessUpdate[key] !== undefined) {
      const value = finiteNumber(businessUpdate[key]);
      if (value === null || (key === "latitude" && (value < -90 || value > 90)) || (key === "longitude" && (value < -180 || value > 180))) return NextResponse.json({ error: `Invalid ${key}.` }, { status: 400 });
      businessUpdate[key] = value;
    }
  }
  if (Object.keys(businessUpdate).length) {
    const { error } = await supabaseAdmin.from("businesses").update(businessUpdate).eq("id", ctx.account.business_id).eq("owner_id", ctx.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const profileUpdate: Record<string, unknown> = {};
  for (const key of ["timezone","cancellation_policy","booking_notice_minutes","max_booking_days"]) if (body && key in body) profileUpdate[key] = body[key];
  if (profileUpdate.booking_notice_minutes !== undefined) {
    const value = finiteNumber(profileUpdate.booking_notice_minutes);
    if (value === null || !Number.isInteger(value) || value < 0) return NextResponse.json({ error: "Booking notice must be a non-negative whole number." }, { status: 400 });
    profileUpdate.booking_notice_minutes = value;
  }
  if (profileUpdate.max_booking_days !== undefined) {
    const value = finiteNumber(profileUpdate.max_booking_days);
    if (value === null || !Number.isInteger(value) || value < 1 || value > 3650) return NextResponse.json({ error: "Maximum booking days must be a whole number between 1 and 3650." }, { status: 400 });
    profileUpdate.max_booking_days = value;
  }
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabaseAdmin.from("service_profiles").update(profileUpdate).eq("business_id", ctx.account.business_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
  if (completion.error) return NextResponse.json({ error: completion.error.message }, { status: 500 });
  const accountUpdate: Record<string, unknown> = {
    completion_percent: completion.data ?? 0,
    invitation_status: "accepted",
    accepted_at: ctx.account.accepted_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (typeof businessUpdate.supplier_contact_name === "string") {
    accountUpdate.contact_name = businessUpdate.supplier_contact_name;
  }

  const { error: accountError } = await supabaseAdmin
    .from("supplier_accounts")
    .update(accountUpdate)
    .eq("id", ctx.account.id)
    .eq("user_id", ctx.user.id);

  if (accountError) {
    if (businessUpdate.supplier_contact_name !== undefined) {
      await supabaseAdmin
        .from("businesses")
        .update({ supplier_contact_name: previousBusinessContactName ?? null })
        .eq("id", ctx.account.business_id)
        .eq("owner_id", ctx.user.id);
    }
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, completion_percent: completion.data ?? 0 });
}

export async function POST(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; offering?: Record<string, unknown>; displayName?: string; bio?: string; staffId?: string; dayOfWeek?: number; startTime?: string; endTime?: string; linkCurrentUser?: boolean } | null;
  if (["submitted", "approved", "live", "rejected"].includes(ctx.account.onboarding_status)) return NextResponse.json({ error: ctx.account.onboarding_status === "submitted" ? "This profile is locked while SafariPlug reviews your submission." : ctx.account.onboarding_status === "rejected" ? "This supplier application is closed and cannot be edited or resubmitted." : "This profile is locked after approval." }, { status: 409 });

  if (body?.action === "request_review") {
    const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
    if (completion.error) return NextResponse.json({ error: completion.error.message }, { status: 500 });
    const completionPercent = Number(completion.data ?? ctx.account.completion_percent ?? 0);
    if (completionPercent < 80) {
      return NextResponse.json({
        error: "Complete at least 80% of your business profile before requesting an early SafariPlug review.",
        completion_percent: completionPercent,
      }, { status: 422 });
    }
    if (ctx.account.review_requested_at) {
      return NextResponse.json({
        success: true,
        review_requested_at: ctx.account.review_requested_at,
        completion_percent: completionPercent,
        message: "SafariPlug profile review is already requested. You can keep completing the remaining activation steps.",
      });
    }
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("supplier_accounts")
      .update({
        onboarding_status: ctx.account.onboarding_status === "draft" ? "onboarding" : ctx.account.onboarding_status,
        review_requested_at: now,
        completion_percent: completionPercent,
        updated_at: now,
      })
      .eq("id", ctx.account.id)
      .eq("user_id", ctx.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      review_requested_at: now,
      completion_percent: completionPercent,
      message: "SafariPlug profile review requested. Keep completing verification, payout and operational setup while staff reviews your profile.",
    });
  }

  if (body?.action === "submit") {
    const readiness = await getSupplierActivationReadiness(ctx.account.id);
    if (!readiness.ready) {
      return NextResponse.json({
        error: "Complete all activation requirements before submitting for SafariPlug review.",
        missing: readiness.issues,
        checks: readiness.checks,
        completion_percent: readiness.completionPercent,
      }, { status: 422 });
    }

    const { data: completion, error } = await supabaseAdmin.rpc("submit_supplier_for_review", {
      p_supplier_id: ctx.account.id,
      p_user_id: ctx.user.id,
    });
    if (error) {
      const message = error.message || "Unable to submit supplier onboarding.";
      if (message.includes("80%")) return NextResponse.json({ error: "Please complete at least 80% of your supplier profile before submitting." }, { status: 422 });
      if (message.includes("Approved suppliers")) return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });
      if (message.includes("Rejected supplier applications")) return NextResponse.json({ error: "This supplier application is closed and cannot be resubmitted." }, { status: 409 });
      if (message.includes("already awaiting review")) return NextResponse.json({ error: "This supplier is already waiting for SafariPlug review." }, { status: 409 });
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ success: true, onboarding_status: "submitted", completion_percent: completion ?? 0 });
  }

  if (body?.action === "offering") {
    const o = body.offering;
    const profile = await supabaseAdmin.from("service_profiles").select("id,category_id").eq("business_id", ctx.account.business_id).single();
    if (profile.error || !profile.data || !o || typeof o.name !== "string" || !o.name.trim()) return NextResponse.json({ error: "Service name is required." }, { status: 400 });
    const duration = finiteNumber(o.duration_minutes);
    const price = finiteNumber(o.price);
    const currency = typeof o.currency === "string" ? o.currency.trim().toUpperCase() : "KES";
    if (duration === null || !Number.isInteger(duration) || duration < 5 || duration > 1440) return NextResponse.json({ error: "Service duration must be a whole number between 5 and 1440 minutes." }, { status: 400 });
    if (price === null || price < 0 || price > 100000000) return NextResponse.json({ error: "Service price must be a valid non-negative amount." }, { status: 400 });
    if (!CURRENCY_PATTERN.test(currency)) return NextResponse.json({ error: "Currency must be a three-letter ISO currency code." }, { status: 400 });
    const slug = o.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!slug) return NextResponse.json({ error: "Service name must contain letters or numbers." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("service_offerings").upsert({ service_profile_id: profile.data.id, category_id: profile.data.category_id, name: o.name.trim(), slug, description: typeof o.description === "string" ? o.description.trim() : null, duration_minutes: duration, price, currency, status: "draft", requires_confirmation: true }, { onConflict: "service_profile_id,slug" }).select("id,name,slug,description,duration_minutes,price,currency,status,requires_confirmation").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: staff } = await supabaseAdmin.from("service_staff").select("id").eq("service_profile_id", profile.data.id).eq("status", "active");
    if (staff?.length) {
      const { error: assignmentError } = await supabaseAdmin.from("service_staff_offerings").upsert(staff.map((member) => ({ staff_id: member.id, offering_id: data.id })), { onConflict: "staff_id,offering_id" });
      if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, offering: data });
  }

  if (body?.action === "staff") {
    const displayName = String(body.displayName || "").trim();
    if (!displayName) return NextResponse.json({ error: "Team member name is required." }, { status: 400 });
    const { data: profile } = await supabaseAdmin.from("service_profiles").select("id").eq("business_id", ctx.account.business_id).single();
    if (!profile) return NextResponse.json({ error: "Service profile not found." }, { status: 404 });
    const normalizedDisplayName = displayName.slice(0, 120);
    const linkCurrentUser = body.linkCurrentUser === true;
    let existingStaff = null as { id: string; display_name: string; bio: string | null; status: string; personal_photo_url: string | null; user_id: string | null; service_profile_id: string } | null;

    if (linkCurrentUser) {
      const { data: linkedStaff, error: linkedStaffError } = await supabaseAdmin
        .from("service_staff")
        .select("id,display_name,bio,status,personal_photo_url,user_id,service_profile_id")
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      if (linkedStaffError) return NextResponse.json({ error: linkedStaffError.message }, { status: 500 });
      if (linkedStaff && linkedStaff.service_profile_id !== profile.id) {
        return NextResponse.json({ error: "This SafariPlug account is already linked to another service specialist." }, { status: 409 });
      }
      existingStaff = linkedStaff;
    }

    if (!existingStaff) {
      const { data: namedStaff, error: existingStaffError } = await supabaseAdmin
        .from("service_staff")
        .select("id,display_name,bio,status,personal_photo_url,user_id,service_profile_id")
        .eq("service_profile_id", profile.id)
        .ilike("display_name", normalizedDisplayName)
        .limit(1)
        .maybeSingle();
      if (existingStaffError) return NextResponse.json({ error: existingStaffError.message }, { status: 500 });
      existingStaff = namedStaff;
    }

    if (existingStaff && linkCurrentUser && !existingStaff.user_id) {
      const { data: linkedStaff, error: linkError } = await supabaseAdmin
        .from("service_staff")
        .update({ user_id: ctx.user.id, verification_state: "unverified", identity_liveness_verified_at: null })
        .eq("id", existingStaff.id)
        .is("user_id", null)
        .select("id,display_name,bio,status,personal_photo_url,user_id,service_profile_id")
        .maybeSingle();
      if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
      if (!linkedStaff) return NextResponse.json({ error: "This specialist profile is already linked to another account." }, { status: 409 });
      existingStaff = linkedStaff;
    } else if (existingStaff && linkCurrentUser && existingStaff.user_id !== ctx.user.id) {
      return NextResponse.json({ error: "This specialist profile is already linked to another account." }, { status: 409 });
    }

    let staffRow = existingStaff;
    if (!staffRow) {
      const { data: createdStaff, error: staffError } = await supabaseAdmin
        .from("service_staff")
        .insert({
          service_profile_id: profile.id,
          display_name: normalizedDisplayName,
          bio: typeof body.bio === "string" ? body.bio.trim().slice(0, 2000) : null,
          status: "active",
          user_id: linkCurrentUser ? ctx.user.id : null,
          verification_state: "unverified",
        })
        .select("id,display_name,bio,status,personal_photo_url,user_id,service_profile_id")
        .single();
      if (staffError || !createdStaff) return NextResponse.json({ error: staffError?.message || "Unable to add team member." }, { status: 500 });
      staffRow = createdStaff;
    }
    const { data: offerings } = await supabaseAdmin.from("service_offerings").select("id").eq("service_profile_id", profile.id);
    if (offerings?.length) {
      const { error: assignmentError } = await supabaseAdmin.from("service_staff_offerings").upsert(offerings.map((offering) => ({ staff_id: staffRow.id, offering_id: offering.id })), { onConflict: "staff_id,offering_id" });
      if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, staff: staffRow, reused: Boolean(existingStaff), linkedCurrentUser: linkCurrentUser && staffRow.user_id === ctx.user.id });
  }

  if (body?.action === "availability") {
    const staffId = String(body.staffId || "");
    const day = Number(body.dayOfWeek);
    const start = String(body.startTime || "");
    const end = String(body.endTime || "");
    const { data: profile } = await supabaseAdmin.from("service_profiles").select("id").eq("business_id", ctx.account.business_id).single();
    if (!profile || !staffId) return NextResponse.json({ error: "Staff member is required." }, { status: 400 });
    const { data: staff } = await supabaseAdmin.from("service_staff").select("id").eq("id", staffId).eq("service_profile_id", profile.id).maybeSingle();
    if (!staff || !Number.isInteger(day) || day < 0 || day > 6 || !TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || start >= end) return NextResponse.json({ error: "Choose a valid day and time range." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("service_staff_availability").upsert({ staff_id: staffId, day_of_week: day, start_time: start, end_time: end, is_active: true }, { onConflict: "staff_id,day_of_week,start_time,end_time" }).select("id,staff_id,day_of_week,start_time,end_time,is_active").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, availability: data });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
