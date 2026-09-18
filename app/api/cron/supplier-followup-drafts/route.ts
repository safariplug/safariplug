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

function draftMessage(input: { name: string; businessName: string; completion: number; missing: string[] }) {
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const list = input.missing.length ? `\n\nPlease complete the following:\n${input.missing.map((item) => `- ${item}`).join("\n")}` : "";
  return {
    subject: `SafariPlug onboarding follow-up for ${input.businessName}`,
    message: `${greeting}\n\nThis is a follow-up on your SafariPlug supplier onboarding. Your profile is currently ${input.completion}% complete.${list}\n\nYour progress is saved. Please sign in to continue:\n${portal}\n\nSafariPlug Supplier Team`,
  };
}

function inferMissing(supplier: any) {
  const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
  const rawProfiles = business?.service_profiles;
  const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
  const offerings = profiles.flatMap((p: any) => Array.isArray(p.service_offerings) ? p.service_offerings : p.service_offerings ? [p.service_offerings] : []);
  const staff = profiles.flatMap((p: any) => Array.isArray(p.service_staff) ? p.service_staff : p.service_staff ? [p.service_staff] : []);
  const missing: string[] = [];
  if (!clean(business?.description)) missing.push("Add a clear business description");
  if (!business?.logo_url && !business?.cover_image_url) missing.push("Add a business logo or cover image");
  if (!profiles.length) missing.push("Create your service profile");
  if (profiles.length && !offerings.length) missing.push("Add at least one service offering with pricing and duration");
  if (profiles.length && !staff.length) missing.push("Add at least one team member or service provider");
  if (staff.some((member: any) => !member.personal_photo_url)) missing.push("Add a personal photo for every listed team member");
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

    const latestDue = new Map<string, any>();
    for (const row of due || []) if (!latestDue.has(row.supplier_id)) latestDue.set(row.supplier_id, row);

    let prepared = 0;
    let skipped = 0;
    for (const [supplierId, previous] of latestDue) {
      const { data: supplier, error } = await supabaseAdmin
        .from("supplier_accounts")
        .select("id,business_id,contact_name,onboarding_status,completion_percent,review_items,businesses!inner(id,name,email,description,logo_url,cover_image_url,service_profiles(id,service_offerings(id),service_staff(id,personal_photo_url)))")
        .eq("id", supplierId)
        .maybeSingle();
      if (error || !supplier || !["draft","onboarding","in_progress","changes_requested"].includes(String(supplier.onboarding_status || ""))) { skipped++; continue; }

      const { data: verification } = await supabaseAdmin.from("verification_cases").select("status").eq("subject_type","provider").eq("subject_id",supplier.business_id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      const enriched = { ...supplier, verification_status: verification?.status || null };
      const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
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
    return NextResponse.json({ ok: true, prepared, skipped, checked: latestDue.size });
  } catch (error) {
    console.error("Supplier follow-up draft preparation failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Draft preparation failed" }, { status: 500 });
  }
}
