"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function rejectAIEvent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("AI event ID is missing.");

  const { error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error("Failed to reject AI event: " + error.message);
  }

  revalidatePath("/admin/ai-events");
}
