"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { discoverBusinesses } from "./discovery";
import { scoreProspect } from "./scoring";

const SCOUT_CITIES = [
  "Nairobi", "Mombasa", "Diani", "Kilifi", "Malindi", "Watamu", "Lamu",
  "Zanzibar", "Kampala", "Dar es Salaam", "Accra", "Lagos",
  "Cape Town", "Johannesburg", "Cairo", "Casablanca",
] as const;

const SCOUT_CATEGORIES = [
  "Barbers", "Hair & Beauty", "Spas & Massage", "Tattoo Artists & Body Art",
  "Nails", "Lashes & Brows", "Fitness & Personal Training",
  "Yoga/Pilates/Mindfulness", "Diving & Marine", "Surfing & Board Sports",
  "Water Sports & Kite", "Tours & Local Guides", "Photography & Content",
  "Private Chefs & Cooking", "Hotels", "Restaurants", "Nightlife",
  "Tour Operators", "Experiences",
] as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function executeScout(city: string, category: string) {
  const prospects = await discoverBusinesses(city, category);
  let inserted = 0;

  for (const prospect of prospects) {
    const intelligence = scoreProspect({
      business_name: prospect.business_name,
      category: prospect.category,
      city: prospect.city,
    });

    const { data: existingProspect, error: lookupError } = await supabaseAdmin
      .from("ai_sales_prospects")
      .select("id")
      .eq("business_name", prospect.business_name)
      .eq("city", city)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existingProspect) continue;

    const { error } = await supabaseAdmin.from("ai_sales_prospects").insert({
      business_name: prospect.business_name,
      category: prospect.category,
      city: prospect.city,
      website: prospect.website,
      instagram: prospect.instagram,
      facebook: prospect.facebook,
      contact_email: prospect.contact_email,
      phone: prospect.phone,
      source_url: prospect.source_url,
      source_name: prospect.source_name,
      description: prospect.description,
      opportunity_score: intelligence.score,
      notes: [
        `${intelligence.priority} priority. ${intelligence.reason}`,
        prospect.notes,
      ].filter(Boolean).join("\n"),
      status: "pending_review",
      review_status: "pending_review",
    });

    if (error) throw error;
    inserted += 1;
  }

  return { discovered: prospects.length, inserted };
}

export async function runSalesScout(formData: FormData) {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) throw new Error(error.message);
    console.error("SALES ACTION AUTH ERROR:", error);
    throw new Error(error instanceof Error ? error.message : "Request failed");
  }

  const city = cleanText(formData.get("city")) || "Nairobi";
  const category = cleanText(formData.get("category")) || "Hotels";
  const result = await executeScout(city, category);
  revalidatePath("/admin/ai-sales");
  return result;
}

/** Server Action adapter for the admin form. The form action contract must return void. */
export async function runSalesScoutForm(formData: FormData): Promise<void> {
  await runSalesScout(formData);
}

/** Server-only entry point for the authenticated cron route. */
export async function runScheduledSalesScout() {
  const pairs = SCOUT_CITIES.flatMap((city) =>
    SCOUT_CATEGORIES.map((category) => ({ city, category }))
  );

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * 6) % pairs.length;
  const selected = Array.from({ length: 6 }, (_, index) => pairs[(start + index) % pairs.length]);

  let discovered = 0;
  let inserted = 0;
  const completed: Array<{ city: string; category: string; discovered: number; inserted: number }> = [];

  for (const pair of selected) {
    const result = await executeScout(pair.city, pair.category);
    discovered += result.discovered;
    inserted += result.inserted;
    completed.push({ ...pair, ...result });
  }

  revalidatePath("/admin/ai-sales");
  return { discovered, inserted, completed };
}
