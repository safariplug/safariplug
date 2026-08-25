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


    venue_name:
      discovery.venue_name ??
      "To be verified",


    category:
      discovery.category,


    start_at:
      discovery.start_at ??
      new Date().toISOString(),


    end_at:
      discovery.end_at ??
      new Date(
        Date.now() + 3 * 60 * 60 * 1000
      ).toISOString(),


    price:
      discovery.price ?? 0,


    currency:
      discovery.currency ?? "KES",


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