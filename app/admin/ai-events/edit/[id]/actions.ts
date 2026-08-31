"use server";

import { approveAIEvent } from "../../actions/approve";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateAIEvent(
  id: string,
  formData: FormData
) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const venueAddress = String(formData.get("venue_address") ?? "").trim();
  const organizerName = String(formData.get("organizer_name") ?? "").trim();
  const startAtRaw = String(formData.get("start_at") ?? "").trim();
  const endAtRaw = String(formData.get("end_at") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  const { data: existingEvent, error: existingEventError } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("organizer_name, source_url, image_url")
    .eq("id", id)
    .single();

  if (existingEventError || !existingEvent) {
    throw new Error("AI event not found: " + (existingEventError?.message ?? "unknown error"));
  }

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!category) {
    throw new Error("Category is required.");
  }

  if (!city) {
    throw new Error("City is required.");
  }

  const price =
    priceRaw === ""
      ? null
      : Number(priceRaw);

  if (priceRaw !== "" && !Number.isFinite(price)) {
    throw new Error("Price must be a valid number.");
  }

  const startAt =
    startAtRaw === ""
      ? null
      : startAtRaw.length === 16
        ? `${startAtRaw}:00`
        : startAtRaw;

  const endAt =
    endAtRaw === ""
      ? null
      : endAtRaw.length === 16
        ? `${endAtRaw}:00`
        : endAtRaw;

  if (!startAt) {
    throw new Error("Start date and time are required.");
  }

  const reviewChecks = [
    Boolean(existingEvent.image_url),
    Boolean(description),
    Boolean(startAt),
    Boolean(venueName),
    Boolean(venueAddress),
    price !== null && Number.isFinite(price),
    Boolean(organizerName),
    Boolean(endAt),
    Boolean(existingEvent.source_url),
  ];

  const reviewScore = Math.round(
    (reviewChecks.filter(Boolean).length / reviewChecks.length) * 100
  );


  const { error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      is_featured: formData.get("is_featured") === "on",
      title,
      description,
      category,
      city,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      organizer_name: organizerName || null,
      start_at: startAt,
      end_at: endAt,
      price,
      currency: currency || null,

      review_score: reviewScore,

      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to update AI event: ${error.message}`
    );
  }

  revalidatePath("/admin/ai-events");
  revalidatePath(`/admin/ai-events/edit/${id}`);

  redirect(`/admin/ai-events/edit/${id}`);
}


export async function publishAIEvent(id: string) {
 // Use the same authoritative publishing path as Approve & Publish.
 // This performs the server-side quality gate, duplicate check,
 // live events insert, and AI discovery approval in one place.
 await approveAIEvent(id);

  revalidatePath("/admin/ai-events");
 revalidatePath(`/admin/ai-events/edit/${id}`);
  redirect("/admin/ai-events");
}
export async function rejectAIEvent(id: string) {
  const { error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      status: "rejected",
      review_status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to reject AI event: ${error.message}`
    );
  }

  revalidatePath("/admin/ai-events");

  redirect("/admin/ai-events");
}

