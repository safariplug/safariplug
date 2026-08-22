"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function restoreAIEvent(id: string) {
  const { error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      status: "pending_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error("Failed to restore AI event: " + error.message);
  }

  revalidatePath("/admin/ai-events");
}
