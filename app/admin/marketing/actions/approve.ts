"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";

export async function approveMarketingDraft(id: number) {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "approved",
      publish_status: "ready_to_publish",
      approved_at: new Date().toISOString(),
      approved_by: "admin",
      publish_error: null,
    })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}

export async function rejectMarketingDraft(id: number) {
  await requireAdmin();

  // Rejection means the campaign is discarded, not retained as a rejected record.
  // Only a current draft can be deleted; approved/scheduled/published campaigns
  // are intentionally protected from this action.
  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}
