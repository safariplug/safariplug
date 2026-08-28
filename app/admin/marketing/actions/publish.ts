"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function publishMarketingDraft(id: number) {
  const { data: draft, error: fetchError } = await supabaseAdmin
    .from("marketing_drafts")
    .select("id,status,publish_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!draft) {
    throw new Error("Marketing draft not found.");
  }

  if (draft.status !== "approved" || draft.publish_status !== "ready_to_publish") {
    throw new Error("Marketing draft failed publish gate. Draft must be approved and ready_to_publish.");
  }

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      publish_status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved")
    .eq("publish_status", "ready_to_publish");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}