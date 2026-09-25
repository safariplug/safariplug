import { supabaseAdmin } from "@/lib/supabase-admin";
import { chooseOutreachContact } from "@/lib/services/crm-outreach";
import { resolveStablePartnerIdForProspect } from "@/lib/services/crm-partner-link";

export type OutreachContext = {
  prospectId: string | null;
  partnerId: string | null;
  contactId: string | null;
  businessName: string;
  partnerType: string;
  contactEmail: string;
  whatsappPhone: string;
  contactSource: "crm_contact" | "discovered_business_email" | "none";
  prospectStatus: string;
  reviewStatus: string;
  linkageError: string | null;
};

export async function resolveOutreachContext(prospectId: string): Promise<OutreachContext | null> {
  const { data: prospect, error } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("id,business_name,category,contact_email,status,review_status")
    .eq("id", prospectId)
    .single();

  if (error || !prospect) return null;

  const [{ data: primary }, { data: fallback }] = await Promise.all([
    supabaseAdmin
      .from("crm_contacts")
      .select("id,email,phone,partner_id")
      .eq("prospect_id", prospectId)
      .eq("is_primary", true)
      .maybeSingle(),
    supabaseAdmin
      .from("crm_contacts")
      .select("id,email,phone,partner_id")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const choice = chooseOutreachContact(primary, fallback, prospect.contact_email);
  let partnerId: string | null = null;
  let linkageError: string | null = null;
  try {
    partnerId = await resolveStablePartnerIdForProspect(prospectId);
  } catch (error) {
    linkageError = error instanceof Error ? error.message : "CRM partner linkage could not be resolved.";
  }

  return {
    prospectId,
    partnerId,
    contactId: choice.contactId,
    businessName: prospect.business_name,
    partnerType: prospect.category || "Other travel partner",
    contactEmail: choice.contactEmail,
    whatsappPhone: choice.whatsappPhone,
    contactSource: choice.contactSource,
    prospectStatus: prospect.status,
    reviewStatus: prospect.review_status,
    linkageError,
  };
}
