"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function listMarketingDrafts() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("marketing_drafts")
    .select(
      "id, event_id, event_name, city, platform, content_type, draft_content, creative_brief, image_url, video_url, external_url, status, publish_status, approved_at, metricool_status, publish_error"
    )
    .in("status", ["draft", "approved", "rejected"])
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);
  return { success: true, drafts: data || [] };
}
