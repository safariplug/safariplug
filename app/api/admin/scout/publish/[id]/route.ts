import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function createSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


const CITY_ALIASES: Record<string, string> = {
  "Stone Town (Zanzibar City)": "Zanzibar",
  "Stone Town": "Zanzibar",
};


export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {

  const { id } = await context.params;


  // Get AI Scout discovery
  const { data: discovery, error: discoveryError } =
    await supabaseAdmin
      .from("ai_discovered_events")
      .select("*")
      .eq("id", id)
      .single();


  if (discoveryError || !discovery) {
    return NextResponse.json(
      {
        error: "Discovery not found"
      },
      {
        status: 404
      }
    );
  }
  const title = typeof discovery.title === "string" ? discovery.title.trim() : "";
  const description = typeof discovery.description === "string" ? discovery.description.trim() : "";
  const sourceUrl = typeof discovery.source_url === "string" ? discovery.source_url.trim() : "";
  const cityName = typeof discovery.city === "string" ? discovery.city.trim() : "";
  const startAt = typeof discovery.start_at === "string" ? discovery.start_at.trim() : "";

  if (!title || !description || !sourceUrl || !cityName || !startAt) {
    return NextResponse.json(
      { error: "Discovery is missing required publish data." },
      { status: 400 }
    );
  }

  const startDate = new Date(startAt);

  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { error: "Discovery has an invalid start date." },
      { status: 400 }
    );
  }

  if (startDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Cannot publish an expired event." },
      { status: 400 }
    );
  }

  // Convert AI city name into database city
  const normalizedCity =
    CITY_ALIASES[discovery.city] ?? discovery.city;


  const { data: city, error: cityError } =
    await supabaseAdmin
      .from("cities")
      .select("id")
      .eq("name", normalizedCity)
      .single();


  if (cityError || !city) {
    return NextResponse.json(
      {
        error: `City not found: ${normalizedCity}`
      },
      {
        status: 400
      }
    );
  }



  const eventPayload = {

    title: discovery.title,


    slug:
      createSlug(discovery.title)
      +
      "-"
      +
      Date.now(),


    description:
      discovery.description ??
      "Experience discovered by SafariPlug AI Scout.",


    city_id: city.id,


    venue_name: discovery.venue_name ?? null,


    category:
      discovery.category,


    start_at: discovery.start_at,


    end_at: discovery.end_at ?? null,


    price: discovery.price ?? null,


    currency: discovery.currency ?? null,


    image_url:
      discovery.image_url,


    source_url:
      discovery.source_url,


    organizer_name:
      discovery.organizer_name,


    source_type:
      "AI_SCOUT",


    verified:
      true,


    ai_confidence:
      discovery.confidence_score,


    status:
  "approved"

  };



  const { data: event, error } =
    await supabaseAdmin
      .from("events")
      .insert(eventPayload)
      .select()
      .single();



  if (error) {

    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );

  }



  await supabaseAdmin
    .from("ai_discovered_events")
    .update({
      status:
  "approved"
    })
    .eq("id", id);



  return NextResponse.json(
    {
      success: true,
      event
    }
  );

}