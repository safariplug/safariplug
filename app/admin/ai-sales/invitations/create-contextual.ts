"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveOutreachContext } from "./context";

export async function createContextualPartnerInvitation(formData: FormData) {
  const admin = await requireAdmin();
  const prospectId = String(formData.get("prospect_id") || "").trim();
  if (!prospectId) throw new Error("Prospect ID is required.");

  const context = await resolveOutreachContext(prospectId);
  if (!context) throw new Error("Prospect could not be resolved.");
  if (!context.contactEmail && !context.whatsappPhone) {
    throw new Error("Add an email or phone number to the CRM contact before creating outreach.");
  }

  const channel = context.contactEmail && context.whatsappPhone
    ? "both"
    : context.contactEmail
      ? "email"
      : "whatsapp";

  const { data: invitation, error } = await supabaseAdmin
    .from("partner_invitations")
    .insert({
      business_name: context.businessName,
      partner_type: context.partnerType,
      contact_email: context.contactEmail || null,
      whatsapp_phone: context.whatsappPhone || null,
      channel,
      prospect_id: context.prospectId,
      partner_id: context.partnerId,
      contact_id: context.contactId,
      created_by: admin.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !invitation) throw new Error(error?.message || "Invitation could not be created.");

  const { error: activityError } = await supabaseAdmin.from("crm_activities").insert({
    prospect_id: context.prospectId,
    partner_id: context.partnerId,
    contact_id: context.contactId,
    activity_type: "email",
    summary: "Governed outreach candidate created",
    details: `Invitation ${invitation.id} was added to the draft queue. Nothing was sent.`,
  });
  if (activityError) throw new Error(activityError.message);

  revalidatePath(`/admin/ai-sales/edit/${prospectId}`);
  revalidatePath("/admin/ai-sales/invitations");
  redirect(`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(prospectId)}`);
}
