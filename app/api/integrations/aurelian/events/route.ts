import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateIntegrationKey } from "@/lib/integrations/api-key";

export async function GET(request: Request) {
  if (!validateIntegrationKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, category, venue_name, start_at, end_at, price, currency, image_url, cities(name)"
    )
    .eq("status", "approved")
    .order("start_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    source: "SafariPlug",
    count: events?.length ?? 0,
    experiences: events ?? [],
  });
}
