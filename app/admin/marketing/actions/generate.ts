"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { openai } from "@/lib/openai";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

type ApprovedEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  city: string | null;
  venue_name: string | null;
  venue_address: string | null;
  start_at: string | null;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  status: string;
};

type MarketingDraft = {
  platform: string;
  content_type: string;
  draft_content: string;
};

const PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "linkedin",
  "x"
] as const;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeJsonParse(value: string): MarketingDraft[] {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Amani response was not an array");
  }

  return parsed.map((item) => {
    const draft =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : {};

    return {
      platform: cleanText(draft.platform).toLowerCase(),
      content_type: cleanText(draft.content_type),
      draft_content: cleanText(draft.draft_content),
    };
  });
}

function formatEvent(event: ApprovedEvent): string {
  return [
    `Title: ${event.title}`,
    `Description: ${event.description || "Information needs verification."}`,
    `Category: ${event.category || "Information needs verification."}`,
    `City: ${event.city || "Information needs verification."}`,
    `Venue: ${event.venue_name || "Information needs verification."}`,
    `Venue address: ${event.venue_address || "Information needs verification."}`,
    `Start: ${event.start_at || "Information needs verification."}`,
    `End: ${event.end_at || "Information needs verification."}`,
    `Price: ${
      event.price === null || event.price === undefined
        ? "Information needs verification."
        : `${event.currency || "KES"} ${event.price}`
    }`,
    `Image URL: ${event.image_url || "Information needs verification."}`,
    `Source URL: ${event.source_url || "Information needs verification."}`,
    `Source name: ${event.source_name || "Information needs verification."}`,
  ].join("\n");
}

export async function generateMarketingDrafts(eventId: string) {
  await requireAdmin();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!eventId?.trim()) {
    throw new Error("Missing event ID");
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("ai_discovered_events")
    .select(`
      id,
      title,
      description,
      category,
      city,
      venue_name,
      venue_address,
      start_at,
      end_at,
      price,
      currency,
      image_url,
      source_url,
      source_name,
      status
    `)
    .eq("id", eventId)
    .eq("status", "approved")
    .single();

  if (eventError || !event) {
    console.error("MARKETING EVENT ERROR:", eventError);
    throw new Error("Could not load approved event");
  }

  const approvedEvent = event as ApprovedEvent;

  const prompt = [
    "Create SafariPlug marketing drafts for this approved event.",
    "",
    "SafariPlug voice:",
    "- Local",
    "- Exciting",
    "- Experience-driven",
    "- Discovery-focused",
    "- Social",
    "- Action-oriented",
    "",
    "Lead phrases when natural:",
    "- What are you doing tonight?",
    "- Weekend plans",
    "- Discover something new",
    "- Hidden gems",
    "- Experience more",
    "",
    "Rules:",
    "- Use only information supplied about the event.",
    "- Never invent dates, prices, venues, performers, sponsors, links, or claims.",
    "- Never imply an event is free unless the supplied information says price is zero/free.",
    "- If information is missing, write exactly: Information needs verification.",
    "- Do not publish anything.",
    "- These are drafts requiring human approval.",
    "",
    "Create exactly one draft for each platform:",
    ...PLATFORMS.map((platform) => `- ${platform}`),
    "",
    "Use an appropriate content_type for each platform.",
    "",
    "Return ONLY a JSON array with exactly this structure:",
    "[",
    '  {"platform":"instagram","content_type":"post","draft_content":"..."},',
    '  {"platform":"tiktok","content_type":"caption","draft_content":"..."},',
    '  {"platform":"facebook","content_type":"post","draft_content":"..."},',
    '  {"platform":"linkedin","content_type":"post","draft_content":"..."},',
    '  {"platform":"x","content_type":"post","draft_content":"..."}',
    "]",
    "",
    "EVENT:",
    formatEvent(approvedEvent),
  ].join("\n");

  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: [
          "You are Amani, SafariPlug's Marketing & Growth AI Director.",
          "You create marketing drafts only.",
          "You never publish, send, approve, or trigger external actions.",
          "Use only evidence-backed event information supplied in the prompt.",
          "Never invent missing facts.",
          "Return only valid JSON.",
        ].join(" "),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("Amani returned an empty response");
  }

  let drafts: MarketingDraft[];

  try {
    drafts = safeJsonParse(text);
  } catch (error) {
    console.error("AMANI JSON ERROR:", text);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Amani returned invalid marketing data"
    );
  }

  const validDrafts = drafts.filter(
    (draft) =>
      PLATFORMS.includes(draft.platform as (typeof PLATFORMS)[number]) &&
      cleanText(draft.content_type) &&
      cleanText(draft.draft_content)
  );

  if (validDrafts.length === 0) {
    throw new Error("Amani returned no valid marketing drafts");
  }

  const rows = validDrafts.map((draft) => ({
    event_id: approvedEvent.id,
    event_name: approvedEvent.title,
    city: approvedEvent.city || "",
    platform: draft.platform,
    content_type: draft.content_type,
    draft_content: draft.draft_content,
    status: "draft",
    publish_status: "not_ready",
    image_url: approvedEvent.image_url,
    video_url: null,
    external_url: approvedEvent.source_url,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("marketing_drafts")
    .insert(rows)
    .select("id, platform, content_type");

  if (insertError) {
    console.error("MARKETING INSERT ERROR:", insertError);
    throw new Error(insertError.message);
  }

  revalidatePath("/admin/marketing");

  return {
    event_id: approvedEvent.id,
    event_name: approvedEvent.title,
    drafts_created: inserted?.length || 0,
    platforms: inserted?.map((draft) => draft.platform) || [],
  };
}

type SingleDraftPlatform = "instagram" | "whatsapp" | "newsletter";

export async function generateMarketingDraft({
  eventId,
  platform,
}: {
  eventId: string;
  platform: SingleDraftPlatform;
}) {
  try {
    await requireAdmin();

    const { data: event, error } = await supabaseAdmin
      .from("ai_discovered_events")
      .select("title, description, category, venue_name, price, currency, start_at, status")
      .eq("id", eventId)
      .eq("status", "approved")
      .single();

    if (error || !event) {
      throw new Error(error?.message || "Event not found.");
    }

    const title = event.title || "Untitled Experience";
    const venue = event.venue_name || "Information needs verification";
    const priceText =
      event.price && event.price > 0
        ? `${event.currency || "KES"} ${event.price}`
        : "Free";
    const dateText = event.start_at
      ? new Date(event.start_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Information needs verification";
    const description = event.description || "Information needs verification.";

    return {
      success: true as const,
      platform,
      eventTitle: title,
      generatedCopy: `🔥 **${title}**\n\n📍 Where: ${venue}\n📅 When: ${dateText}\n💰 Access: ${priceText}\n\n${description}\n\n✨ Discover more on SafariPlug. Experience more.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketing generation failed.";
    console.error("Marketing generation error:", message);

    return {
      success: false as const,
      error: message,
    };
  }
}