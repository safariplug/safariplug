import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getRequestUser, getSupabaseUserClient } from "@/lib/supabase-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser(request: Request) {
  const bearerClient = getSupabaseUserClient(request);
  if (bearerClient.ok) {
    const user = await getRequestUser(bearerClient.client);
    if (user && !user.is_anonymous && user.email_confirmed_at) return user;
    return null;
  }
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("saved_events")
    .select("id,event_id,created_at,events(id,title,description,category,venue_name,price,currency,image_url,start_at,end_at,is_featured,status,cities(id,name,country))")
    .eq("traveler_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data || [] });
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const eventId = String(body.eventId || "").trim();
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  const { data: event } = await supabaseAdmin.from("events").select("id,status").eq("id", eventId).maybeSingle();
  if (!event || event.status !== "approved") return NextResponse.json({ error: "Experience not available" }, { status: 404 });
  const { data: existing } = await supabaseAdmin.from("saved_events").select("id").eq("traveler_id", user.id).eq("event_id", eventId).maybeSingle();
  if (existing) return NextResponse.json({ saved: true, id: existing.id, alreadySaved: true });
  const { data, error } = await supabaseAdmin.from("saved_events").insert({ traveler_id: user.id, event_id: eventId }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true, id: data.id, alreadySaved: false }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("saved_events").delete().eq("traveler_id", user.id).eq("event_id", eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: false });
}
