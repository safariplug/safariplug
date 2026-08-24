"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function publishMarketingDraft(id: number) {
  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      publish_status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}