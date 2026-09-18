import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function validPhotoUrl(value: string, userId: string) {
  if (!/^https:\/\//i.test(value) || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.pathname.includes("/driver-profile-photos/") &&
      url.pathname.includes(`/${userId}/`)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const driverId = String(body.driverId || "").trim();
  const personalPhotoUrl = String(body.personalPhotoUrl || "").trim();
  if (!driverId || !validPhotoUrl(personalPhotoUrl, user.id)) {
    return NextResponse.json({ error: "A valid SafariPlug driver profile photo is required." }, { status: 400 });
  }

  const { data: driver, error: lookupError } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,user_id")
    .eq("id", driverId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!driver) return NextResponse.json({ error: "Driver profile not found." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .update({ personal_photo_url: personalPhotoUrl })
    .eq("id", driver.id)
    .eq("user_id", user.id)
    .select("id,personal_photo_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    driver: data,
    verificationChanged: false,
    serviceStatusChanged: false,
  });
}
