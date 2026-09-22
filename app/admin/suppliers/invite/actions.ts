"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createManualSupplierInvite(formData: FormData) {
  const admin = await requireAdmin();
  const businessName = clean(formData.get("business_name"));
  const category = clean(formData.get("category")) || "Other";
  const city = clean(formData.get("city"));
  const website = clean(formData.get("website"));
  const contactName = clean(formData.get("contact_name"));
  const contactEmail = clean(formData.get("contact_email")).toLowerCase();
  const phone = clean(formData.get("phone"));
  const notes = clean(formData.get("notes"));

  if (!businessName) throw new Error("Business name is required.");
  if (!contactName) throw new Error("Contact name is required.");
  if (!contactEmail && !phone) throw new Error("Add at least an email address or phone number.");

  let existing: { id: string } | null = null;
  if (contactEmail) {
    const { data, error } = await supabaseAdmin
      .from("ai_sales_prospects")
      .select("id")
      .eq("contact_email", contactEmail)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = data;
  }
  if (!existing && phone) {
    const { data, error } = await supabaseAdmin
      .from("ai_sales_prospects")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = data;
  }
  if (existing?.id) redirect("/admin/ai-sales/edit/" + existing.id);

  let prospectId: string | null = null;
  let partnerId: string | null = null;
  let contactId: string | null = null;

  try {
    const { data: prospect, error: prospectError } = await supabaseAdmin.from("ai_sales_prospects").insert({
      business_name: businessName, category, city: city || null, website: website || null,
      contact_email: contactEmail || null, phone: phone || null, source_name: "manual_staff_entry",
      description: notes || null, notes: "Created manually by SafariPlug staff for governed supplier invitation.",
      status: "approved", review_status: "approved", opportunity_score: 0,
    }).select("id").single();
    if (prospectError || !prospect) throw new Error(prospectError?.message || "Unable to create supplier prospect.");
    prospectId = prospect.id;

    const { data: partner, error: partnerError } = await supabaseAdmin.from("safari_partners").insert({
      venue_or_promoter_name: businessName, contact_person: contactName, email_or_phone: contactEmail || phone,
      outreach_stage: "prospect", notes: ["Manual supplier invitation", website ? "Website: " + website : null, notes || null].filter(Boolean).join("\n"),
    }).select("id").single();
    if (partnerError || !partner) throw new Error(partnerError?.message || "Unable to create partner relationship.");
    partnerId = partner.id;

    const { data: contact, error: contactError } = await supabaseAdmin.from("crm_contacts").insert({
      prospect_id: prospectId, partner_id: partnerId, full_name: contactName, email: contactEmail || null,
      phone: phone || null, is_primary: true, verification_status: "unverified",
      notes: "Primary contact entered manually by SafariPlug staff.",
    }).select("id").single();
    if (contactError || !contact) throw new Error(contactError?.message || "Unable to create supplier contact.");
    contactId = contact.id;

    const channel = contactEmail && phone ? "both" : contactEmail ? "email" : "whatsapp";
    const { data: invitation, error: invitationError } = await supabaseAdmin.from("partner_invitations").insert({
      business_name: businessName, partner_type: category, contact_email: contactEmail || null, whatsapp_phone: phone || null,
      channel, status: "draft", prospect_id: prospectId, partner_id: partnerId, contact_id: contactId, created_by: admin.id,
    }).select("id").single();
    if (invitationError || !invitation) throw new Error(invitationError?.message || "Unable to create supplier invitation.");

    const { error: activityError } = await supabaseAdmin.from("crm_activities").insert({
      prospect_id: prospectId, partner_id: partnerId, contact_id: contactId, activity_type: "approval",
      summary: "Manual supplier invitation created",
      details: "SafariPlug staff created invitation " + invitation.id + ". The prospect was human-entered and approved for governed outreach. Nothing was sent automatically.",
    });
    if (activityError) throw new Error(activityError.message);
  } catch (error) {
    if (prospectId) {
      await supabaseAdmin.from("partner_invitations").delete().eq("prospect_id", prospectId).eq("status", "draft");
      await supabaseAdmin.from("crm_activities").delete().eq("prospect_id", prospectId);
      await supabaseAdmin.from("crm_contacts").delete().eq("prospect_id", prospectId);
      await supabaseAdmin.from("ai_sales_prospects").delete().eq("id", prospectId);
    }
    if (partnerId) await supabaseAdmin.from("safari_partners").delete().eq("id", partnerId);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/ai-sales/invitations");
  redirect("/admin/ai-sales/invitations?prospect_id=" + encodeURIComponent(prospectId!));
}