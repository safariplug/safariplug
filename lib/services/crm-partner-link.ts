import { supabaseAdmin } from "@/lib/supabase-admin";

type PartnerLinkRow = { partner_id: string | null };

function collectStableIds(rows: PartnerLinkRow[] | null | undefined, ids: Set<string>) {
  for (const row of rows || []) {
    if (row.partner_id) ids.add(String(row.partner_id));
  }
}

export async function resolveStablePartnerIdForProspect(prospectId: string) {
  const [
    { data: suppliers, error: supplierError },
    { data: contacts, error: contactError },
    { data: conversions, error: conversionError },
    { data: invitations, error: invitationError },
    { data: activities, error: activityError },
  ] = await Promise.all([
    supabaseAdmin
      .from("supplier_accounts")
      .select("partner_id")
      .eq("prospect_id", prospectId)
      .not("partner_id", "is", null),
    supabaseAdmin
      .from("crm_contacts")
      .select("partner_id")
      .eq("prospect_id", prospectId)
      .not("partner_id", "is", null),
    supabaseAdmin
      .from("crm_conversions")
      .select("partner_id")
      .eq("prospect_id", prospectId)
      .not("partner_id", "is", null),
    supabaseAdmin
      .from("partner_invitations")
      .select("partner_id")
      .eq("prospect_id", prospectId)
      .not("partner_id", "is", null),
    supabaseAdmin
      .from("crm_activities")
      .select("partner_id")
      .eq("prospect_id", prospectId)
      .not("partner_id", "is", null),
  ]);

  for (const error of [supplierError, contactError, conversionError, invitationError, activityError]) {
    if (error) throw new Error(error.message);
  }

  const ids = new Set<string>();
  collectStableIds(suppliers as PartnerLinkRow[] | null, ids);
  collectStableIds(contacts as PartnerLinkRow[] | null, ids);
  collectStableIds(conversions as PartnerLinkRow[] | null, ids);
  collectStableIds(invitations as PartnerLinkRow[] | null, ids);
  collectStableIds(activities as PartnerLinkRow[] | null, ids);

  if (ids.size > 1) {
    throw new Error(
      "Conflicting stable partner links exist for this prospect. Resolve CRM linkage before continuing.",
    );
  }

  return ids.size === 1 ? [...ids][0] : null;
}
