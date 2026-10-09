import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const { data: trip, error } = await supabaseAdmin.from("trips")
    .select("id,title,destination_city_id,start_on,end_on")
    .eq("id", id).eq("traveler_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load journey." }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  const { data: city } = trip.destination_city_id
    ? await supabaseAdmin.from("cities").select("name,country").eq("id", trip.destination_city_id).maybeSingle()
    : { data: null };
  return NextResponse.json({ trip: { ...trip, destination: city?.name || null, country: city?.country || null } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Journey title is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("trips")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("traveler_id", user.id)
    .select("id,title,start_on,end_on,status,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  return NextResponse.json({ trip: data });
}
