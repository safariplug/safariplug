"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";

export async function updateMarketingMedia(
  id: number,
  formData: FormData
) {
  await requireAdmin();

  const image_url = String(formData.get("image_url") ?? "").trim();
  const video_url = String(formData.get("video_url") ?? "").trim();
  const external_url = String(formData.get("external_url") ?? "").trim();

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      image_url: image_url || null,
      video_url: video_url || null,
      external_url: external_url || null,
    })
    .eq("id", id)
    .eq("status", "approved");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing/media");
  revalidatePath("/admin/marketing");
}
