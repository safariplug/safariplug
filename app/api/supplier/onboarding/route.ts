import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function supplierContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: account } = await supabaseAdmin.from("supplier_accounts").select("id,user_id,business_id,contact_name,invitation_status,onboarding_status,completion_percent").eq("user_id", user.id).maybeSingle();
  if (!account) return null;
  return { user, account };
}

export async function GET() {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const { data: business } = await supabaseAdmin.from("businesses").select("id,name,description,business_type,city_id,address,latitude,longitude,phone,whatsapp,email,website_url,instagram_url,facebook_url,tiktok_url,logo_url,cover_image_url,supplier_contact_name,supplier_gallery_urls,status").eq("id", ctx.account.business_id).single();
  const { data: profile } = await supabaseAdmin.from("service_profiles").select("id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days").eq("business_id", ctx.account.business_id).single();
  const { data: offerings } = await supabaseAdmin.from("service_offerings").select("id,name,slug,description,duration_minutes,price,currency,status,requires_confirmation").eq("service_profile_id", profile?.id ?? "00000000-0000-0000-0000-000000000000").order("created_at");
  const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
  return NextResponse.json({ account: { ...ctx.account, completion_percent: completion.data ?? ctx.account.completion_percent }, business, profile, offerings: offerings ?? [] });
}

export async function PATCH(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  if (["approved", "live"].includes(ctx.account.onboarding_status)) return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const allowedBusiness = ["name","description","address","latitude","longitude","phone","whatsapp","website_url","instagram_url","facebook_url","tiktok_url","logo_url","cover_image_url","supplier_gallery_urls"] as const;
  const businessUpdate: Record<string, unknown> = {};
  for (const key of allowedBusiness) if (body && key in body) businessUpdate[key] = body[key];
  if (businessUpdate.name !== undefined && (typeof businessUpdate.name !== "string" || !businessUpdate.name.trim())) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  if (Object.keys(businessUpdate).length) {
    const { error } = await supabaseAdmin.from("businesses").update(businessUpdate).eq("id", ctx.account.business_id).eq("owner_id", ctx.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const profileKeys = ["timezone","cancellation_policy","booking_notice_minutes","max_booking_days"] as const;
  const profileUpdate: Record<string, unknown> = {};
  for (const key of profileKeys) if (body && key in body) profileUpdate[key] = body[key];
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabaseAdmin.from("service_profiles").update(profileUpdate).eq("business_id", ctx.account.business_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
  const { error: accountError } = await supabaseAdmin.from("supplier_accounts").update({ completion_percent: completion.data ?? 0, invitation_status: "accepted", accepted_at: ctx.account.accepted_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ctx.account.id);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  return NextResponse.json({ success: true, completion_percent: completion.data ?? 0 });
}

export async function POST(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; offering?: Record<string, unknown> } | null;
  if (body?.action === "submit") {
    const completion = await supabaseAdmin.rpc("supplier_completion", { p_business_id: ctx.account.business_id });
    if ((completion.data ?? 0) < 80) return NextResponse.json({ error: "Please complete at least 80% of your supplier profile before submitting." }, { status: 422 });
    const { error } = await supabaseAdmin.from("supplier_accounts").update({ onboarding_status: "submitted", invitation_status: "accepted", accepted_at: ctx.account.accepted_at ?? new Date().toISOString(), submitted_at: new Date().toISOString(), completion_percent: completion.data ?? 0, updated_at: new Date().toISOString() }).eq("id", ctx.account.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("businesses").update({ status: "pending" }).eq("id", ctx.account.business_id);
    return NextResponse.json({ success: true, onboarding_status: "submitted" });
  }
  if (body?.action === "offering") {
    const o = body.offering;
    const profile = await supabaseAdmin.from("service_profiles").select("id,category_id").eq("business_id", ctx.account.business_id).single();
    if (profile.error || !profile.data || !o || typeof o.name !== "string" || !o.name.trim()) return NextResponse.json({ error: "Service name is required." }, { status: 400 });
    const slug = o.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const { data, error } = await supabaseAdmin.from("service_offerings").upsert({ service_profile_id: profile.data.id, category_id: profile.data.category_id, name: o.name.trim(), slug, description: typeof o.description === "string" ? o.description.trim() : null, duration_minutes: Number(o.duration_minutes) || 60, price: Number(o.price) || 0, currency: typeof o.currency === "string" ? o.currency : "KES", status: "draft", requires_confirmation: true }, { onConflict: "service_profile_id,slug" }).select("id,name,slug,description,duration_minutes,price,currency,status,requires_confirmation").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, offering: data });
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
