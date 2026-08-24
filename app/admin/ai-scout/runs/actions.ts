"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function createScoutRun() {

  const supabase = await createSupabaseServerClient();


  const { data, error } = await supabase
    .from("ai_scout_runs")
    .insert({
      location: "East Africa",
      category: "Events & Experiences",
      status: "completed",
      events_found: 1,
      discoveries_found: 1,
      sources_checked: 1,
      sent_for_review: 1,
      notes: "AI Scout manual discovery test run."
    })
    .select()
    .single();


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath("/admin/ai-scout");

  return data;

}