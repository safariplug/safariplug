"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function approveSalesProspect(id: string) {
  await requireAdmin();

  const { data: prospect, error: prospectError } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*")
    .eq("id", id)
    .single();

  if (prospectError || !prospect) {
    throw new Error(prospectError?.message || "Sales prospect not found.");
  }

  const { data: existingPartner, error: partnerLookupError } =
    await supabaseAdmin
      .from("safari_partners")
      .select("id")
      .eq("venue_or_promoter_name", prospect.business_name)
      .maybeSingle();

  if (partnerLookupError) {
    throw new Error(partnerLookupError.message);
  }

  if (!existingPartner) {
    const { error: partnerInsertError } = await supabaseAdmin
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
        ]
          .filter(Boolean)
          .join("\n"),
      });

    if (partnerInsertError) {
      throw new Error(
        `Partner CRM persistence failed: ${partnerInsertError.message}`
      );
    }
  }

  const { error: prospectUpdateError } = await supabaseAdmin
    .from("ai_sales_prospects")
    .update({
      status: "partner",
      review_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (prospectUpdateError) {
    throw new Error(prospectUpdateError.message);
  }

  revalidatePath("/admin/ai-sales");
  revalidatePath("/admin/ai-sales/partners");

  redirect("/admin/ai-sales");
}

export async function rejectSalesProspect(id: string) {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("ai_sales_prospects")
    .update({
      status: "rejected",
      review_status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/ai-sales");
  redirect("/admin/ai-sales");
}
