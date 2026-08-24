"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function rejectMarketingDraft(id: number) {
  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "rejected",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}