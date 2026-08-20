"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

function createSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now()
  );
}

export async function approveAIEvent(id: string) {
  const { data: aiEvent, error: aiError } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*")
    .eq("id", id)
    .single();

  if (aiError || !aiEvent) {
    throw new Error("AI event not found");
  }

  if (aiEvent.status === "approved") {
    revalidatePath("/admin/ai-events");
    revalidatePath("/events");
    return;
  }

  const { data: city, error: cityError } = await supabaseAdmin
    .from("cities")
    .select("id")
    .ilike("name", aiEvent.city)
    .single();

  if (cityError || !city) {
    throw new Error("City not found: " + aiEvent.city);
  }

  const { data: existingEvent, error: duplicateCheckError } =
    await supabaseAdmin
      .from("events")
      .select("id")
      .eq("source_url", aiEvent.source_url)
      .eq("title", aiEvent.title)
      .eq("start_at", aiEvent.start_at)
      .maybeSingle();

  if (duplicateCheckError) {
    throw new Error(
      "Duplicate check failed: " + duplicateCheckError.message
    );
  }

  if (existingEvent) {
    const { error: statusError } = await supabaseAdmin
      .from("ai_discovered_events")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (statusError) {
      throw new Error(
        "Failed to update AI event status: " + statusError.message
      );
    }

    revalidatePath("/admin/ai-events");
    revalidatePath("/events");

    return;
  }

  const slug = createSlug(aiEvent.title);

  const { error: insertError } = await supabaseAdmin
    .from("events")
    .insert({
      title: aiEvent.title,
      slug,
      description: aiEvent.description,
      city_id: city.id,
      venue_name: aiEvent.venue_name,
      venue_address: aiEvent.venue_address,
      category: aiEvent.category,
      start_at: aiEvent.start_at,
      end_at: aiEvent.end_at,
      price: aiEvent.price,
      currency: aiEvent.currency,
      image_url: aiEvent.image_url,
      source_url: aiEvent.source_url,
      organizer_name: aiEvent.source_name,
      status: "approved",
      featured: false,
    });

  if (insertError) {
    console.error("PUBLISH ERROR", insertError);

    throw new Error(
      "Failed to publish event: " + insertError.message
    );
  }

  const { error: statusError } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (statusError) {
    throw new Error(
      "Event published, but AI status update failed: " +
        statusError.message
    );
  }

  revalidatePath("/admin/ai-events");
  revalidatePath("/events");
}