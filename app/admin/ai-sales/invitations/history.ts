import { supabaseAdmin } from "@/lib/supabase-admin";

export async function loadProspectOutreachHistory(prospectId: string) {
  const { data, error } = await supabaseAdmin
    .from("partner_invitations")
    .select("id,status,channel,contact_email,whatsapp_phone,created_at,sent_at")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { invitations: [], error };
  return { invitations: data || [], error: null };
}
