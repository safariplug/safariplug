import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tripId = typeof body?.tripId === "string" ? body.tripId : "";
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id: unknown): id is string => typeof id === "string") : [];
  if (!tripId || !itemIds.length) return NextResponse.json({ error: "tripId and itemIds are required." }, { status: 400 });

  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  if (!trip) return NextResponse.json({ error: "Journey not found." }, { status: 404 });

  const { data: items, error } = await supabaseAdmin.from("trip_items").select("id").eq("trip_id", tripId).in("id", itemIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((items?.length || 0) !== itemIds.length) return NextResponse.json({ error: "One or more itinerary items do not belong to this journey." }, { status: 400 });

  for (const [position, itemId] of itemIds.entries()) {
    const { error: updateError } = await supabaseAdmin.from("trip_items").update({ position }).eq("id", itemId).eq("trip_id", tripId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabaseAdmin.from("trips").update({ updated_at: new Date().toISOString() }).eq("id", tripId).eq("traveler_id", user.id);
  return NextResponse.json({ reordered: true });
}
