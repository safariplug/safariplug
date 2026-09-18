import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function requirementLink(requirement: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
  const base = `${site}/supplier/onboarding`;
  if (requirement.includes("description")) return `${base}#business-details`;
  if (requirement.includes("logo") || requirement.includes("cover image")) return `${base}#business-images`;
  if (requirement.includes("service offering") || requirement.includes("pricing and duration")) return `${base}#services-pricing`;
  if (requirement.includes("team member") || requirement.includes("personal photo") || requirement.includes("availability")) return `${base}#team-availability`;
  if (requirement.includes("payout")) return `${site}/business/payouts`;
  if (requirement.includes("verification")) return `${site}/supplier/readiness`;
  return base;
}

function draftMessage(input: { name: string; businessName: string; completion: number; missing: string[] }) {
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const list = input.missing.length ? `\n\nPlease complete the following:\n${input.missing.map((item) => `- ${item}: ${requirementLink(item)}`).join("\n")}` : "";
  return {
    subject: `SafariPlug onboarding follow-up for ${input.businessName}`,
    message: `${greeting}\n\nThis is a follow-up on your SafariPlug supplier onboarding. Your profile is currently ${input.completion}% complete.${list}\n\nYour progress is saved. Please sign in to continue:\n${portal}\n\nSafariPlug Supplier Team`,
  };
}

type ServiceStaff = { id?: string; personal_photo_url?: string | null };
type ServiceOffering = { price?: number | string | null; duration_minutes?: number | null };
type ServiceProfile = { service_offerings?: ServiceOffering[] | ServiceOffering | null; service_staff?: ServiceStaff[] | ServiceStaff | null };
type SupplierBusiness = { name?: string | null; email?: string | null; description?: string | null; logo_url?: string | null; cover_image_url?: string | null; service_profiles?: ServiceProfile[] | ServiceProfile | null };
type SupplierForDraft = { businesses?: SupplierBusiness[] | SupplierBusiness | null; completion_percent?: number | null; review_items?: unknown[] | null; verification_status?: string | null; availability_count?: number | null; payout_status?: string | null };

function inferMissing(supplier: SupplierForDraft) {
  const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
  const rawProfiles = business?.service_profiles;
  const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
  const offerings = profiles.flatMap((p: ServiceProfile) => Array.isArray(p.service_offerings) ? p.service_offerings : p.service_offerings ? [p.service_offerings] : []);
  const staff = profiles.flatMap((p: ServiceProfile) => Array.isArray(p.service_staff) ? p.service_staff : p.service_staff ? [p.service_staff] : []);
  const missing: string[] = [];
  if (!clean(business?.description)) missing.push("Add a clear business description");
  if (!business?.logo_url && !business?.cover_image_url) missing.push("Add a business logo or cover image");
  if (!profiles.length) missing.push("Create your service profile");
  if (profiles.length && !offerings.length) missing.push("Add at least one service offering with pricing and duration");
  if (offerings.length && offerings.some((offering) => Number(offering.price || 0) <= 0 || Number(offering.duration_minutes || 0) <= 0)) {
    missing.push("Complete pricing and duration for all service offerings");
  }
  if (profiles.length && !staff.length) missing.push("Add at least one team member or service provider");
  if (staff.some((member: ServiceStaff) => !member.personal_photo_url)) missing.push("Add a personal photo for every listed team member");
  if (staff.length && Number(supplier.availability_count || 0) === 0) missing.push("Add active availability for at least one team member");
  if (!supplier.payout_status) missing.push("Set up your payout account");
  else if (supplier.payout_status !== "verified") missing.push(`Complete payout account verification (currently ${label(String(supplier.payout_status))})`);
  if (!supplier.verification_status) missing.push("Start supplier verification");
  else if (supplier.verification_status !== "approved") missing.push(`Complete supplier verification (currently ${label(String(supplier.verification_status))})`);
  for (const item of Array.isArray(supplier.review_items) ? supplier.review_items : []) {
    missing.push(`Review requested: ${label(String(item))}`);
  }
  if (!missing.length && Number(supplier.completion_percent || 0) < 100) missing.push("Complete the remaining onboarding steps shown in your supplier portal");
  return [...new Set(missing)].slice(0, 20);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  try {
    const now = new Date().toISOString();
    const { data: due, error: dueError } = await supabaseAdmin
      .from("supplier_onboarding_followups")
      .select("supplier_id,sent_at,next_followup_due_at,missing_requirements")
      .eq("status", "sent")
      .lte("next_followup_due_at", now)
      .order("sent_at", { ascending: false })
      .limit(200);
    if (dueError) throw dueError;

    type DueRow = { supplier_id: string; sent_at: string; next_followup_due_at: string | null; missing_requirements: unknown };
    const latestDue = new Map<string, DueRow>();
    for (const row of (due || []) as DueRow[]) if (!latestDue.has(row.supplier_id)) latestDue.set(row.supplier_id, row);

    let prepared = 0;
    let skipped = 0;
    for (const [supplierId, previous] of latestDue) {
      const { data: supplier, error } = await supabaseAdmin
        .from("supplier_accounts")
        .select("id,user_id,business_id,contact_name,onboarding_status,completion_percent,review_items,businesses!inner(id,name,email,description,logo_url,cover_image_url,service_profiles(id,service_offerings(id,price,duration_minutes),service_staff(id,personal_photo_url)))")
        .eq("id", supplierId)
        .maybeSingle();
      if (error || !supplier || !["draft","onboarding","in_progress","changes_requested"].includes(String(supplier.onboarding_status || ""))) { skipped++; continue; }

      const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
      const rawProfiles = business?.service_profiles;
      const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
      const staffIds = profiles.flatMap((profile: ServiceProfile) => {
        const raw = profile.service_staff;
        const members = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return members.map((member: ServiceStaff & { id?: string }) => member.id).filter((id): id is string => Boolean(id));
      });
      const [{ data: verification }, { count: availabilityCount }, { data: payout }] = await Promise.all([
        supabaseAdmin.from("verification_cases").select("status").eq("subject_type","provider").eq("subject_id",supplier.business_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
        staffIds.length
          ? supabaseAdmin.from("service_staff_availability").select("id",{count:"exact",head:true}).in("staff_id",staffIds).eq("is_active",true)
          : Promise.resolve({count:0}),
        supabaseAdmin.from("service_provider_payout_accounts").select("status").eq("provider_user_id",supplier.user_id).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
      ]);
      const enriched = {
        ...supplier,
        verification_status: verification?.status || null,
        availability_count: availabilityCount || 0,
        payout_status: payout?.status || null,
      };
      const recipient = clean(business?.email, 320).toLowerCase();
      if (!recipient || !recipient.includes("@")) { skipped++; continue; }

      const missing = inferMissing(enriched);
      const previousRequirements = Array.isArray(previous.missing_requirements) ? previous.missing_requirements.map(String) : [];
      const comparison = {
        previousSentAt: previous.sent_at,
        resolvedSinceLast: previousRequirements.filter((item: string) => !missing.includes(item)),
        stillMissing: missing.filter((item) => previousRequirements.includes(item)),
        newlyMissing: missing.filter((item) => !previousRequirements.includes(item)),
      };
      const draft = draftMessage({
        name: clean(supplier.contact_name, 200),
        businessName: clean(business?.name, 300) || "your business",
        completion: Number(supplier.completion_percent || 0),
        missing,
      });

      const { data: existing } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").select("id").eq("supplier_id",supplierId).eq("status","prepared").maybeSingle();
      if (existing) {
        const { error: updateError } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").update({
          recipient_email: recipient, subject: draft.subject, message: draft.message, missing_requirements: missing, comparison, prepared_at: now, updated_at: now,
        }).eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").insert({
          supplier_id: supplierId, recipient_email: recipient, subject: draft.subject, message: draft.message, missing_requirements: missing, comparison, status: "prepared", prepared_at: now, updated_at: now,
        });
        if (insertError) throw insertError;
      }
      prepared++;
    }
    await supabaseAdmin.from("supplier_followup_prep_runs").insert({
      status: "success",
      checked_count: latestDue.size,
      prepared_count: prepared,
      skipped_count: skipped,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, prepared, skipped, checked: latestDue.size });
  } catch (error) {
    console.error("Supplier follow-up draft preparation failed", error);
    const message = error instanceof Error ? error.message : "Draft preparation failed";
    await supabaseAdmin.from("supplier_followup_prep_runs").insert({
      status: "failed",
      checked_count: 0,
      prepared_count: 0,
      skipped_count: 0,
      error_message: message.slice(0, 1000),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
