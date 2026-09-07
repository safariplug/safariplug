import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("trips")
    .select("id,title,destination_city_id,start_on,end_on,status,created_at,updated_at,cities:destination_city_id(id,name,country,slug)")
    .eq("traveler_id", user.id)
    .order("start_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "My SafariPlug Trip";
  const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 120) : "";
  const startOn = typeof body.startOn === "string" && body.startOn ? body.startOn : null;
  const endOn = typeof body.endOn === "string" && body.endOn ? body.endOn : null;

  let destinationCityId: string | null = null;
  if (destination) {
    const { data: city } = await supabaseAdmin
      .from("cities")
      .select("id")
      .or(`name.ilike.%${destination}%,slug.ilike.%${destination}%`)
      .limit(1)
      .maybeSingle();
    destinationCityId = city?.id ?? null;
  }

  const { data: trip, error } = await supabaseAdmin
    .from("trips")
    .insert({ traveler_id: user.id, title, destination_city_id: destinationCityId, start_on: startOn, end_on: endOn, status: "planning" })
    .select("id,title,destination_city_id,start_on,end_on,status,created_at,updated_at,cities:destination_city_id(id,name,country,slug)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ trip }, { status: 201 });
}
