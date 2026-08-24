"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function updateMarketingMedia(
  id: number,
  formData: FormData
) {

  const image_url = formData.get("image_url") as string;
  const video_url = formData.get("video_url") as string;
  const external_url = formData.get("external_url") as string;


  console.log("MEDIA UPDATE:", {
    id,
    image_url,
    video_url,
    external_url,
  });


  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      image_url: image_url || null,
      video_url: video_url || null,
      external_url: external_url || null,
    })
    .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath("/admin/marketing/media");
  revalidatePath("/marketing");
}