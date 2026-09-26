"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveStablePartnerIdForProspect } from "@/lib/services/crm-partner-link";
import { salesProspectQualityIssues } from "@/lib/services/sales-prospect-quality";

const PATH = "/admin/ai-sales";
const BATCH_LIMIT = 50;

async function persistStablePartnerLink(prospectId: string, partnerId: string) {
  const now = new Date().toISOString();
  const [
    { error: contactError },
    { error: supplierError },
    { error: invitationError },
    { error: activityError },
    { error: conversionError },
  ] = await Promise.all([
    supabaseAdmin.from("crm_contacts").update({ partner_id: partnerId, updated_at: now }).eq("prospect_id", prospectId).is("partner_id", null),
    supabaseAdmin.from("supplier_accounts").update({ partner_id: partnerId, updated_at: now }).eq("prospect_id", prospectId).is("partner_id", null),
    supabaseAdmin.from("partner_invitations").update({ partner_id: partnerId, updated_at: now }).eq("prospect_id", prospectId).is("partner_id", null),
    supabaseAdmin.from("crm_activities").update({ partner_id: partnerId }).eq("prospect_id", prospectId).is("partner_id", null),
    supabaseAdmin.from("crm_conversions").update({ partner_id: partnerId }).eq("prospect_id", prospectId).is("partner_id", null),
  ]);
  for (const error of [contactError, supplierError, invitationError, activityError, conversionError]) {
    if (error) throw new Error(error.message);
  }
}

function resultUrl(message: string) {
  return `${PATH}?stage=pending_review&contact=email&bulk_review=${encodeURIComponent(message)}#prospect-feed`;
}

export async function approveSelectedSalesProspects(formData: FormData) {
  const admin = await requireAdmin();
  const ids = Array.from(new Set(
    formData.getAll("prospect_id").map((value) => String(value || "").trim()).filter(Boolean),
  )).slice(0, BATCH_LIMIT);

  if (!ids.length) redirect(resultUrl("Select at least one quality-ready prospect first."));

  const { data: prospects, error } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*")
    .in("id", ids)
    .eq("review_status", "pending_review")
    .eq("status", "pending_review");

  if (error) throw new Error(error.message);

  let approved = 0;
  let skipped = 0;
  let failed = 0;
  let draftWarnings = 0;

  for (const prospect of prospects || []) {
    try {
      if (!prospect.contact_email || salesProspectQualityIssues(prospect).length) {
        skipped++;
        continue;
      }

      let partnerId = await resolveStablePartnerIdForProspect(prospect.id);
      if (!partnerId) {
        const { data: newPartner, error: partnerInsertError } = await supabaseAdmin
          .from("safari_partners")
          .insert({
            venue_or_promoter_name: prospect.business_name,
            contact_person: null,
            email_or_phone: prospect.contact_email || prospect.phone || null,
            instagram_handle: prospect.instagram || null,
            outreach_stage: "prospect",
            notes: [
              prospect.description,
              prospect.website ? `Website: ${prospect.website}` : null,
              prospect.facebook ? `Facebook: ${prospect.facebook}` : null,
              prospect.source_name ? `Source: ${prospect.source_name}` : null,
              prospect.source_url ? `Source URL: ${prospect.source_url}` : null,
              prospect.notes || null,
            ].filter(Boolean).join("\n"),
          })
          .select("id")
          .single();
        if (partnerInsertError || !newPartner) {
          throw new Error(partnerInsertError?.message || "No relationship record returned.");
        }
        partnerId = newPartner.id;
      }

      if (!partnerId) throw new Error("Stable partner ID could not be resolved.");
      await persistStablePartnerLink(prospect.id, partnerId);

      const now = new Date().toISOString();
      const { data: changed, error: updateError } = await supabaseAdmin
        .from("ai_sales_prospects")
        .update({ status: "approved", review_status: "approved", updated_at: now })
        .eq("id", prospect.id)
        .eq("status", "pending_review")
        .eq("review_status", "pending_review")
        .select("id")
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);
      if (!changed) {
        skipped++;
        continue;
      }

      approved++;

      const { error: activityInsertError } = await supabaseAdmin.from("crm_activities").insert({
        prospect_id: prospect.id,
        partner_id: partnerId,
        activity_type: "approval",
        summary: "Prospect approved for governed outreach",
        details: `Bulk human approval by admin ${admin.id}. Approval qualifies the prospect for outreach; nothing was sent.`,
      });
      if (activityInsertError) {
        console.error("Bulk prospect approval activity log failed", prospect.id, activityInsertError);
        draftWarnings++;
      }

      const { data: existingInvite, error: inviteLookupError } = await supabaseAdmin
        .from("partner_invitations")
        .select("id")
        .eq("prospect_id", prospect.id)
        .limit(1)
        .maybeSingle();
      if (inviteLookupError) {
        console.error("Bulk prospect invitation lookup failed after approval", prospect.id, inviteLookupError);
        draftWarnings++;
        continue;
      }

      if (!existingInvite) {
        const { error: inviteError } = await supabaseAdmin.from("partner_invitations").insert({
          business_name: prospect.business_name,
          partner_type: prospect.category || "Other",
          contact_email: prospect.contact_email,
          whatsapp_phone: null,
          channel: "email",
          prospect_id: prospect.id,
          partner_id: partnerId,
          contact_id: null,
          created_by: admin.id,
          status: "draft",
        });
        if (inviteError) {
          console.error("Bulk prospect outreach draft creation failed after approval", prospect.id, inviteError);
          draftWarnings++;
          continue;
        }

        const { error: draftActivityError } = await supabaseAdmin.from("crm_activities").insert({
          prospect_id: prospect.id,
          partner_id: partnerId,
          activity_type: "system",
          summary: "Governed outreach draft created automatically",
          details: "Bulk human prospect approval opened the outreach workflow. Nothing was sent.",
        });
        if (draftActivityError) {
          console.error("Bulk prospect draft activity log failed", prospect.id, draftActivityError);
          draftWarnings++;
        }
      }
    } catch (approvalError) {
      console.error("Bulk prospect approval failed", prospect.id, approvalError);
      failed++;
    }
  }

  revalidatePath(PATH);
  revalidatePath("/admin/ai-sales/invitations");
  revalidatePath("/admin/ai-sales/partners");
  revalidatePath("/admin/crm");

  redirect(resultUrl(
    `Approved ${approved} selected prospect${approved === 1 ? "" : "s"} for governed outreach.` +
    `${skipped ? ` ${skipped} were skipped because their state or quality gate changed.` : ""}` +
    `${failed ? ` ${failed} failed before approval and can be reviewed again.` : ""}` +
    `${draftWarnings ? ` ${draftWarnings} approved record${draftWarnings === 1 ? "" : "s"} need CRM/draft follow-up.` : ""}` +
    " Drafts were created only; nothing was sent."
  ));
}
