"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function approveMarketingDraft(id: number) {
  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "approved",
      publish_status: "ready_to_publish",
      approved_at: new Date().toISOString(),
      approved_by: "admin",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}


export async function rejectMarketingDraft(id: number) {
  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "rejected",
      publish_status: "not_ready",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}