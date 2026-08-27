import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type DiscoveredPartner = {
  venue_or_promoter_name: string;
  contact_person: string;
  email_or_phone: string;
  instagram_handle: string;
  outreach_stage: string;
  notes: string;
};

const discoveredPartners: DiscoveredPartner[] = [
  {
    venue_or_promoter_name: "The Alchemist Bar",
    contact_person: "Events Desk",
    email_or_phone: "+254700000001",
    instagram_handle: "alchemistbar",
    outreach_stage: "prospect",
    notes: "AI Discovered: Prime nightlife hub in Westlands.",
  },
  {
    venue_or_promoter_name: "Moov Cafe & Lounge",
    contact_person: "Management",
    email_or_phone: "+254700000002",
    instagram_handle: "moov_nairobi",
    outreach_stage: "prospect",
    notes: "AI Discovered: Popular rooftop events space.",
  },
  {
    venue_or_promoter_name: "Giraffe Ark Game Lodge",
    contact_person: "Reservations",
    email_or_phone: "+254700000003",
    instagram_handle: "giraffearklodge",
    outreach_stage: "prospect",
    notes: "AI Discovered: High-end destination experiences.",
  },
];

export async function POST() {
  try {
    let insertedCount = 0;

    for (const partner of discoveredPartners) {
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("safari_partners")
        .select("id")
        .eq("venue_or_promoter_name", partner.venue_or_promoter_name)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      if (!existing) {
        const { error: insertError } = await supabaseAdmin
          .from("safari_partners")
          .insert(partner);

        if (insertError) {
          throw new Error(insertError.message);
        }

        insertedCount += 1;
      }
    }

    const { error: telemetryError } = await supabaseAdmin
      .from("admin_telemetry_logs")
      .insert({
        action_type: "ai_partners_discovered",
        metadata: {
          count: discoveredPartners.length,
          inserted_count: insertedCount,
        },
      });

    if (telemetryError) {
      throw new Error(telemetryError.message);
    }

    return NextResponse.json({
      success: true,
      count: discoveredPartners.length,
      insertedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Partner discovery failed.";
    console.error("Partner discovery error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
