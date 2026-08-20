"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateAIEvent(
  id: string,
  formData: FormData
) {
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const category = String(formData.get("category") ?? "");
  const city = String(formData.get("city") ?? "");
  const venueName = String(formData.get("venue_name") ?? "");
  const priceRaw = String(formData.get("price") ?? "");

  const price =
    priceRaw.trim() === ""
      ? null
      : Number(priceRaw);

  console.log("UPDATE AI EVENT");
  console.log({
    id,
    title,
    description,
    category,
    city,
    venueName,
    price,
  });

  const { data, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      title,
      description,
      category,
      city,
      venue_name: venueName,
      price,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  console.log("SUPABASE UPDATE RESULT");
  console.log({
    data,
    error,
  });

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