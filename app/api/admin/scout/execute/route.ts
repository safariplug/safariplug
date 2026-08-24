import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  const location = "Nairobi";
  const category = "Music & Nightlife";

  // Create run record
  const { data: run, error: runError } =
    await supabaseAdmin
      .from("ai_scout_runs")
      .insert({
        location,
        category,
        status: "running",
        events_found: 0,
        discoveries_found: 0,
        sources_checked: 1,
        sent_for_review: 0,
        notes: "AI Scout execution started."
      })
      .select()
      .single();


  if (runError) {
    return NextResponse.json(
      { error: runError.message },
      { status: 500 }
    );
  }


  // Phase 1 test discovery
  // This will later be replaced by the AI/web collectors

  const { data: discovery, error: discoveryError } =
    await supabaseAdmin
      .from("ai_discovered_events")
      .insert({
        title: "Nairobi Weekend Experience",
        description:
          "A curated nightlife and entertainment experience discovered by SafariPlug AI Scout.",

        city: "Nairobi",

        category:
          "Music & Nightlife",

        venue_name:
          "Local Experience Venue",

        organizer_name:
          "SafariPlug Scout",

        source_name:
          "AI Scout",

        source_type:
          "AI_SCOUT",

        confidence_score:
          85,

        review_score:
          85,

        status:
          "pending_review",

        review_status:
          "pending",

        source_url:
          "https://safariplug.com",

      })
      .select()
      .single();


  if (discoveryError) {

    await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "failed",
        notes: discoveryError.message,
      })
      .eq("id", run.id);


    return NextResponse.json(
      { error: discoveryError.message },
      { status: 500 }
    );
  }


  // Complete run

  await supabaseAdmin
    .from("ai_scout_runs")
    .update({
      status: "completed",
      events_found: 1,
      discoveries_found: 1,
      sent_for_review: 1,
      notes:
        "Discovery created and sent for human review."
    })
    .eq("id", run.id);


  return NextResponse.json({
    success: true,
    run,
    discovery,
  });
}