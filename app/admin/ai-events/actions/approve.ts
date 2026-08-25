"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

function createSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function approveAIEvent(id: string) {

  // Get AI discovery
  const { data: aiEvent, error: fetchError } =
    await supabaseAdmin
      .from("ai_discovered_events")
      .select("*")
      .eq("id", id)
      .single();

  if (fetchError || !aiEvent) {
    throw new Error(
      "AI event not found: " + fetchError?.message
    );
  }
  // Quality Gate
  const reviewScore =
  aiEvent.review_score ??
  aiEvent.confidence_score ??
  0;

if (reviewScore < 80) {
  throw new Error(
    `Event failed quality gate. Review score is ${reviewScore}%. Minimum required is 80%.`
  );
}


  // Find city
  const knownCities = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Kilifi",
  "Mtwapa",
  "Malindi",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam"
];

let cityName = aiEvent.city;

const matchedCity = knownCities.find((city) =>
  aiEvent.city
    ?.toLowerCase()
    .includes(city.toLowerCase())
);

if (matchedCity) {
  cityName = matchedCity;
}


const { data: city, error: cityError } =
    await supabaseAdmin
      .from("cities")
      .select("id")
      .ilike("name", cityName)
      .single();


  if (cityError || !city) {
    throw new Error(
      "City not found: " + aiEvent.city
    );
  }
const cleanCategory =
  aiEvent.category
    ?.replace(cityName, "")
    .trim() || "Experiences";

const { data: existingEvent } =
  await supabaseAdmin
    .from("events")
    .select("id,title")
    .ilike("title", aiEvent.title)
    .limit(1)
    .maybeSingle();

if (existingEvent) {
  throw new Error(
    `Duplicate event already exists: ${existingEvent.title}`
  );
}
  // Create slug
  const baseSlug = createSlug(aiEvent.title);

const slug =
  `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;


  // Create live event
  const { error: insertError } =
    await supabaseAdmin
      .from("events")
      .insert({
        title: aiEvent.title,
        slug,

        description: aiEvent.description,

        city_id: city.id,

        category: cleanCategory,

        venue_name: aiEvent.venue_name,
        venue_address: aiEvent.venue_address,

        start_at: aiEvent.start_at,
        end_at: aiEvent.end_at,

        price: aiEvent.price,
        currency: aiEvent.currency || "KES",

        image_url: aiEvent.image_url,

        source_url: aiEvent.source_url,
        source_type: "AI_SCOUT",

        organizer_name: aiEvent.organizer_name,

        status: "approved",

        featured: false,

        verified: true,
        verified_at: new Date().toISOString(),

        ai_confidence: aiEvent.confidence_score
      });


  if (insertError) {
    throw new Error(
      "Failed creating live event: " +
      insertError.message
    );
  }


    // Mark AI discovery approved + save review tracking

  
  const { error: updateError } =
    await supabaseAdmin
      .from("ai_discovered_events")
      .update({
        status: "approved",

        review_status: "approved",

        review_score: reviewScore,

        image_verified: Boolean(aiEvent.image_url),

        reviewed_at: new Date().toISOString(),

        review_notes: aiEvent.image_url
          ? "Human approved. Official image available."
          : "Human approved. Category fallback image used.",

        updated_at: new Date().toISOString()
      })
      .eq("id", id);


  if (updateError) {
    throw new Error(
      "Failed updating AI event: " +
      updateError.message
    );
  }


  revalidatePath("/admin/ai-events");
  revalidatePath("/events");
}
