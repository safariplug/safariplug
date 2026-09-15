import { supabaseAdmin } from "@/lib/supabase-admin";

export type OutreachContext = {
  prospectId: string | null;
  partnerId: string | null;
  contactId: string | null;
  businessName: string;
  partnerType: string;
  contactEmail: string;
  whatsappPhone: string;
};

export async function resolveOutreachContext(prospectId: string): Promise<OutreachContext | null> {
  const { data: prospect, error } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("id,business_name,category")
    .eq("id", prospectId)
    .single();

  if (error || !prospect) return null;

  const [{ data: partner }, { data: primary }, { data: fallback }] = await Promise.all([
    supabaseAdmin
      .from("safari_partners")
      .select("id")
      .eq("venue_or_promoter_name", prospect.business_name)
      .maybeSingle(),
    supabaseAdmin
      .from("crm_contacts")
      .select("id,email,phone")
      .eq("prospect_id", prospectId)
      .eq("is_primary", true)
      .maybeSingle(),
    supabaseAdmin
      .from("crm_contacts")
      .select("id,email,phone")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const contact = primary || fallback;
  return {
    prospectId,
    partnerId: partner?.id || null,
    contactId: contact?.id || null,
    businessName: prospect.business_name,
    partnerType: prospect.category || "Other travel partner",
    contactEmail: contact?.email || "",
    whatsappPhone: contact?.phone || "",
  };
}
