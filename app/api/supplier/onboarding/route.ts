import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SERVICE_CATALOG } from "@/lib/service-catalog";

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
    .select("id,user_id,business_id,contact_name,invitation_status,onboarding_status,completion_percent,accepted_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return account ? { user, account } : null;
}

export async function GET() {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id,name,description,business_type,city_id,address,latitude,longitude,phone,whatsapp,email,website_url,instagram_url,facebook_url,tiktok_url,logo_url,cover_image_url,supplier_contact_name,supplier_gallery_urls,status")
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
    .select("id,display_name,bio,status")
    .eq("service_profile_id", profile?.id ?? FALLBACK_ID)
    .order("created_at");
  const staffIds = (staff ?? []).map((member) => member.id);
  const { data: availability } = staffIds.length
    ? await supabaseAdmin.from("service_staff_availability").select("id,staff_id,day_of_week,start_time,end_time,is_active").in("staff_id", staffIds).order("day_of_week").order("start_time")
    : { data: [] };
  const category = Array.isArray((profile as any)?.service_categories) ? (profile as any)?.service_categories?.[0] : (profile as any)?.service_categories;
  const suggestedOfferings = category?.slug && SERVICE_CATALOG[category.slug] ? SERVICE_CATALOG[category.slug] : [];
  const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
  return NextResponse.json({ account: { ...ctx.account, completion_percent: completion.data ?? ctx.account.completion_percent }, business, profile: { ...(profile ?? {}), category: category ?? null }, offerings: offerings ?? [], suggestedOfferings, staff: staff ?? [], availability: availability ?? [] });
}

export async function PATCH(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  if (["approved", "live"].includes(ctx.account.onboarding_status)) return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const businessUpdate: Record<string, unknown> = {};
  for (const key of ["name","description","address","latitude","longitude","phone","whatsapp","website_url","instagram_url","facebook_url","tiktok_url","logo_url","cover_image_url","supplier_gallery_urls"]) if (body && key in body) businessUpdate[key] = body[key];
  if (businessUpdate.name !== undefined && (typeof businessUpdate.name !== "string" || !businessUpdate.name.trim())) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
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
  const { error: accountError } = await supabaseAdmin.from("supplier_accounts").update({ completion_percent: completion.data ?? 0, invitation_status: "accepted", accepted_at: ctx.account.accepted_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ctx.account.id).eq("user_id", ctx.user.id);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  return NextResponse.json({ success: true, completion_percent: completion.data ?? 0 });
}

export async function POST(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; offering?: Record<string, unknown>; displayName?: string; bio?: string; staffId?: string; dayOfWeek?: number; startTime?: string; endTime?: string } | null;
  if (["approved", "live"].includes(ctx.account.onboarding_status)) return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });

  if (body?.action === "submit") {
    const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
    if (completion.error) return NextResponse.json({ error: completion.error.message }, { status: 500 });
    if ((completion.data ?? 0) < 80) return NextResponse.json({ error: "Please complete at least 80% of your supplier profile before submitting." }, { status: 422 });
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("supplier_accounts").update({ onboarding_status: "submitted", invitation_status: "accepted", accepted_at: ctx.account.accepted_at ?? now, submitted_at: now, completion_percent: completion.data ?? 0, updated_at: now }).eq("id", ctx.account.id).eq("user_id", ctx.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: businessError } = await supabaseAdmin.from("businesses").update({ status: "pending" }).eq("id", ctx.account.business_id).eq("owner_id", ctx.user.id);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
    return NextResponse.json({ success: true, onboarding_status: "submitted" });
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
    const { data, error } = await supabaseAdmin.from("service_staff").insert({ service_profile_id: profile.id, display_name: displayName.slice(0, 120), bio: typeof body.bio === "string" ? body.bio.trim().slice(0, 2000) : null, status: "active" }).select("id,display_name,bio,status").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: offerings } = await supabaseAdmin.from("service_offerings").select("id").eq("service_profile_id", profile.id);
    if (offerings?.length) {
      const { error: assignmentError } = await supabaseAdmin.from("service_staff_offerings").upsert(offerings.map((offering) => ({ staff_id: data.id, offering_id: offering.id })), { onConflict: "staff_id,offering_id" });
      if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, staff: data });
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
