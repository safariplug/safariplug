import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Trip title is required." }, { status: 400 });
  const payload = {
    traveler_id: user.id,
    title,
    destination_city_id: typeof body.destinationCityId === "string" ? body.destinationCityId : null,
    start_on: typeof body.startOn === "string" ? body.startOn : null,
    end_on: typeof body.endOn === "string" ? body.endOn : null,
    status: "draft",
  };
  const { data, error } = await supabaseAdmin.from("trips").insert(payload).select("id,title,destination_city_id,start_on,end_on,status,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data }, { status: 201 });
}
