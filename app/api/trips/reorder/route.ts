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

  const { data, error } = await supabaseAdmin.rpc("reorder_trip_items", {
    p_trip_id: tripId,
    p_traveler_id: user.id,
    p_item_ids: itemIds,
  });
  if (error) {
    if (error.message.includes("trip_not_found")) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
    if (error.message.includes("trip_item_not_found")) return NextResponse.json({ error: "One or more itinerary items do not belong to this journey." }, { status: 400 });
    if (error.message.includes("duplicate_trip_item_ids")) return NextResponse.json({ error: "Duplicate itinerary items are not allowed." }, { status: 400 });
    if (error.message.includes("trip_items_required")) return NextResponse.json({ error: "tripId and itemIds are required." }, { status: 400 });
    console.error("reorder trip items", error);
    return NextResponse.json({ error: "Unable to reorder this journey." }, { status: 409 });
  }

  return NextResponse.json({ reordered: Boolean(data) });
}
