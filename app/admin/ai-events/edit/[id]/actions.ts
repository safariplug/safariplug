"use server";

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
  const startAtRaw = String(formData.get("start_at") ?? "").trim();
  const endAtRaw = String(formData.get("end_at") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();

  const reviewScore = Number(
    formData.get("review_score") ?? 0
  );

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

  const { error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      title,
      description,
      category,
      city,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
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
  const { approveAIEvent } =
    await import("../../actions/approve");

  await approveAIEvent(id);

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