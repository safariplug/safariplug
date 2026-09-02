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

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "rejected",
      publish_status: "not_ready",
      publish_error: null,
    })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}
