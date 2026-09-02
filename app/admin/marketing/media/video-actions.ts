"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

const OPENAI_VIDEOS_URL = "https://api.openai.com/v1/videos";
const BUCKET = "marketing-media";

function requireOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

async function getDraft(id: number) {
  const { data, error } = await supabaseAdmin
    .from("marketing_drafts")
    .select("id,event_name,city,platform,content_type,draft_content,image_url,video_url,video_job_id,video_status,video_prompt,video_error,status,publish_status")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Marketing draft not found.");
  if (data.status !== "approved") throw new Error("Video generation requires an approved marketing draft.");
  if (data.platform !== "instagram" && data.platform !== "tiktok") {
    throw new Error("Video generation is currently available for Instagram and TikTok campaigns.");
  }
  return data;
}

function buildPrompt(draft: {
  event_name: string;
  city: string | null;
  draft_content: string | null;
}) {
  return [
    "Create a premium vertical travel-and-events social video for SafariPlug.",
    "Format: cinematic 9:16, 8 seconds, energetic but sophisticated East African editorial style.",
    "Do not invent recognizable real people, celebrities, brands, dates, prices, venues, logos, or factual details not supplied below.",
    "Use atmospheric event/travel visuals, natural motion, tasteful lighting, and a polished luxury-travel aesthetic.",
    `Event: ${draft.event_name}`,
    `City: ${draft.city || "East Africa"}`,
    `Campaign copy: ${draft.draft_content || "Discover this experience on SafariPlug."}`,
    "No text overlays are required; keep the visual clean so SafariPlug can add platform-specific copy later.",
  ].join("\n");
}

export async function generateMarketingVideo(id: number, _formData: FormData): Promise<void> {
  await requireAdmin();
  const key = requireOpenAIKey();
  const draft = await getDraft(id);

  if (draft.video_job_id && draft.video_status === "processing") {
    throw new Error("A video generation job is already running for this campaign.");
  }

  const prompt = buildPrompt(draft);
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("seconds", "8");
  form.append("size", "720x1280");

  const response = await fetch(OPENAI_VIDEOS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    cache: "no-store",
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = typeof data.error === "object" && data.error !== null
      ? JSON.stringify(data.error)
      : raw || `OpenAI video API ${response.status}`;
    await supabaseAdmin.from("marketing_drafts").update({ video_status: "error", video_error: detail }).eq("id", id);
    throw new Error(detail);
  }

  const jobId = typeof data.id === "string" ? data.id : null;
  if (!jobId) throw new Error("OpenAI returned no video job ID.");

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      video_job_id: jobId,
      video_status: "processing",
      video_prompt: prompt,
      video_error: null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/marketing/media");
}

export async function refreshMarketingVideo(id: number, _formData: FormData): Promise<void> {
  await requireAdmin();
  const key = requireOpenAIKey();
  const draft = await getDraft(id);

  if (!draft.video_job_id) throw new Error("This campaign has no video generation job.");

  const response = await fetch(`${OPENAI_VIDEOS_URL}/${encodeURIComponent(draft.video_job_id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!response.ok) throw new Error(raw || `OpenAI video status ${response.status}`);

  const status = typeof data.status === "string" ? data.status : "unknown";
  if (status !== "completed") {
    await supabaseAdmin
      .from("marketing_drafts")
      .update({ video_status: status === "failed" ? "error" : "processing", video_error: status === "failed" ? JSON.stringify(data.error || {}) : null })
      .eq("id", id);
    revalidatePath("/admin/marketing/media");
    return;
  }

  const contentResponse = await fetch(`${OPENAI_VIDEOS_URL}/${encodeURIComponent(draft.video_job_id)}/content`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!contentResponse.ok) throw new Error(`Unable to download completed video (${contentResponse.status}).`);

  const videoBytes = await contentResponse.arrayBuffer();
  const bucketResult = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["video/mp4", "video/quicktime"],
    fileSizeLimit: "500MB",
  });
  if (bucketResult.error && !/already exists/i.test(bucketResult.error.message)) {
    throw new Error(bucketResult.error.message);
  }

  const path = `videos/${id}/${draft.video_job_id}.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, videoBytes, { contentType: "video/mp4", cacheControl: "31536000", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const { error: updateError } = await supabaseAdmin
    .from("marketing_drafts")
    .update({ video_status: "completed", video_url: publicUrl.publicUrl, video_error: null })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/marketing/media");
  revalidatePath("/admin/marketing");
}
