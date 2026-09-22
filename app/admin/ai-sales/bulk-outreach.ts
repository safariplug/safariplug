"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveStablePartnerIdForProspect } from "@/lib/services/crm-partner-link";

const PATH = "/admin/ai-sales";

export async function startOutreachForAllApproved() {
  const admin = await requireAdmin();

  const { data: prospects, error: prospectError } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("id,business_name,category,contact_email,status,review_status")
    .eq("review_status", "approved")
    .neq("status", "rejected")
    .not("contact_email", "is", null)
    .order("created_at", { ascending: true });

  if (prospectError) throw new Error(prospectError.message);

  const candidates = (prospects || []).filter((prospect) => Boolean(prospect.contact_email?.trim()));
  if (!candidates.length) {
    redirect(PATH + "?stage=approved&contact=email&outreach=" + encodeURIComponent("No approved email-ready suppliers need outreach."));
  }

  const ids = candidates.map((prospect) => prospect.id);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("partner_invitations")
    .select("prospect_id,status")
    .in("prospect_id", ids);

  if (existingError) throw new Error(existingError.message);

  const alreadyStarted = new Set((existing || []).map((row) => row.prospect_id).filter(Boolean));
  let created = 0;
  let skipped = 0;

  for (const prospect of candidates) {
    if (alreadyStarted.has(prospect.id)) {
      skipped++;
      continue;
    }

    const partnerId = await resolveStablePartnerIdForProspect(prospect.id);
    if (!partnerId) {
      skipped++;
      continue;
    }

    const { error } = await supabaseAdmin.from("partner_invitations").insert({
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

    if (error) {
      console.error("Bulk supplier outreach draft failed", prospect.id, error);
      skipped++;
      continue;
    }

    await supabaseAdmin.from("crm_activities").insert({
      prospect_id: prospect.id,
      partner_id: partnerId,
      activity_type: "system",
      summary: "Governed outreach draft created",
      details: "Created by bulk Start outreach for all approved action. Nothing was sent.",
    });

    created++;
  }

  revalidatePath(PATH);
  revalidatePath("/admin/ai-sales/invitations");
  revalidatePath("/admin/crm");

  const message = created
    ? `Created ${created} governed outreach draft${created === 1 ? "" : "s"}.${skipped ? ` Skipped ${skipped} already-started or unlinked supplier${skipped === 1 ? "" : "s"}.` : ""} Nothing was sent.`
    : `No new drafts were created. ${skipped} approved supplier${skipped === 1 ? "" : "s"} already had outreach or could not be linked.`;

  redirect(PATH + "?stage=approved&contact=email&outreach=" + encodeURIComponent(message) + "#prospect-feed");
}
