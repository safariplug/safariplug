"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { openai } from "@/lib/openai";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

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
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    if (!eventId?.trim()) throw new Error("Missing event ID");

    const { data: event, error } = await supabaseAdmin
      .from("ai_discovered_events")
      .select("id, title, description, category, city, venue_name, price, currency, start_at, image_url, source_url, status")
      .eq("id", eventId)
      .eq("status", "approved")
      .single();

    if (error || !event) throw new Error(error?.message || "Event not found.");

    const title = event.title || "Untitled Experience";
    const venue = event.venue_name || "Information needs verification";
    const priceText = event.price && event.price > 0 ? `${event.currency || "KES"} ${event.price}` : "Free";
    const dateText = event.start_at
      ? new Date(event.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Information needs verification";
    const description = event.description || "Information needs verification.";

    const prompt = [
      `Create one ${platform} marketing draft for this approved SafariPlug event.`,
      "Use only the supplied event information. Never invent dates, prices, venues, performers, sponsors, links, or claims.",
      "Write polished, concise social copy suitable for the selected platform.",
      "Do not publish anything. This is a draft requiring human approval.",
      `EVENT: ${title}`,
      `Category: ${event.category || "Information needs verification"}`,
      `City: ${event.city || "Information needs verification"}`,
      `Venue: ${venue}`,
      `Date: ${dateText}`,
      `Price: ${priceText}`,
      `Description: ${description}`,
    ].join("\n");

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "system",
          content: "You are Amani, SafariPlug's Marketing & Growth AI Director. Create evidence-backed marketing drafts only. Never publish or trigger external actions.",
        },
        { role: "user", content: prompt },
      ],
    });

    const generatedCopy = response.output_text?.trim();
    if (!generatedCopy) throw new Error("Amani returned an empty response");

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("marketing_drafts")
      .insert({
        event_id: event.id,
        event_name: title,
        city: event.city || "",
        platform,
        content_type: platform === "instagram" ? "social_post" : platform,
        draft_content: generatedCopy,
        creative_brief: null,
        status: "draft",
        publish_status: "not_ready",
        image_url: event.image_url,
        video_url: null,
        external_url: event.source_url,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    revalidatePath("/admin/marketing");

    return {
      success: true as const,
      platform,
      eventTitle: title,
      draftId: inserted?.id ?? null,
      generatedCopy,
      queuedForApproval: true as const,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketing generation failed.";
    console.error("Marketing generation error:", message);
    return { success: false as const, error: message };
  }
}
