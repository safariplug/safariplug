"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { scheduleMetricoolInstagramPost } from "@/lib/metricool";
import { revalidatePath } from "next/cache";

export async function publishMarketingDraft(id: number, scheduledAt?: string) {
  await requireAdmin();

  const { data: draft, error: fetchError } = await supabaseAdmin
    .from("marketing_drafts")
    .select(
      "id,status,publish_status,platform,draft_content,image_url,video_url,scheduled_at,metricool_post_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!draft) {
    throw new Error("Marketing draft not found.");
  }

  if (draft.status !== "approved" || draft.publish_status !== "ready_to_publish") {
    throw new Error(
      "Marketing draft failed publish gate. Draft must be approved and ready_to_publish."
    );
  }

  if (draft.platform !== "instagram") {
    throw new Error("Only Instagram drafts are currently connected to Metricool.");
  }

  if (draft.metricool_post_id) {
    throw new Error("This draft has already been sent to Metricool.");
  }

  const targetTime = scheduledAt
    ? new Date(scheduledAt)
    : new Date(Date.now() + 5 * 60 * 1000);

  if (Number.isNaN(targetTime.getTime())) {
    throw new Error("Invalid scheduled publication time.");
  }

  try {
    const result = await scheduleMetricoolInstagramPost({
      text: draft.draft_content,
      imageUrl: draft.image_url,
      videoUrl: draft.video_url,
      scheduledAt: targetTime,
    });

    const { error: updateError } = await supabaseAdmin
      .from("marketing_drafts")
      .update({
        publish_status: "published",
        scheduled_at: targetTime.toISOString(),
        published_at: null,
        metricool_post_id: result.postId,
        metricool_status: "scheduled",
        publish_error: null,
      })
      .eq("id", id)
      .eq("status", "approved")
      .eq("publish_status", "ready_to_publish");

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath("/admin/marketing");

    return {
      success: true,
      scheduledAt: targetTime.toISOString(),
      metricoolPostId: result.postId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Metricool publishing failed.";

    await supabaseAdmin
      .from("marketing_drafts")
      .update({
        metricool_status: "error",
        publish_error: message,
      })
      .eq("id", id);

    throw new Error(message);
  }
}
