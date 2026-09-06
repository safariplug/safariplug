import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !user.email_confirmed_at) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return NextResponse.json({ error: "trip_id_required" }, { status: 400 });

  const { data: trip } = await supabaseAdmin.from("trips").select("id,share_token").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  if (!trip) return NextResponse.json({ error: "trip_not_found" }, { status: 404 });

  const token = trip.share_token || crypto.randomBytes(24).toString("base64url");
  if (!trip.share_token) {
    const { error } = await supabaseAdmin.from("trips").update({ share_token: token, updated_at: new Date().toISOString() }).eq("id", tripId).eq("traveler_id", user.id);
    if (error) return NextResponse.json({ error: "could_not_create_share_link" }, { status: 500 });
  }

  return NextResponse.json({ shareUrl: `/trips/shared/${token}` });
}
