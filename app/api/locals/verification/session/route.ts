import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createSumsubAccessToken,
  sumsubConfigured,
  sumsubVerificationLevel,
} from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json(
      { error: "A confirmed SafariPlug account is required." },
      { status: 401 }
    );
  }

  if (!sumsubConfigured()) {
    return NextResponse.json(
      { error: "Local identity/liveness verification is not configured yet. SafariPlug will not simulate approval." },
      { status: 503 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("local_profiles")
    .select("id,display_name,personal_photo_url,languages,interests,terms_accepted_at,verification_state")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Create your Local profile first." }, { status: 404 });
  }
  if (!profile.personal_photo_url || !profile.languages?.length || !profile.interests?.length || !profile.terms_accepted_at) {
    return NextResponse.json({ error: "Complete your Local profile before starting verification." }, { status: 409 });
  }

  let { data: current, error: caseError } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,expires_at")
    .eq("subject_type", "local")
    .eq("subject_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 500 });
  }

  if (
    current?.status === "approved" &&
    (!current.expires_at || new Date(current.expires_at) > new Date())
  ) {
    return NextResponse.json({ error: "Local verification is already approved." }, { status: 409 });
  }

  if (!current || ["rejected", "revoked", "expired"].includes(current.status)) {
    const created = await supabaseAdmin
      .from("verification_cases")
      .insert({
        subject_type: "local",
        subject_id: profile.id,
        status: "pending",
        verification_level: "enhanced",
        provider: "sumsub",
        notes: "Local identity + live face/liveness verification started from authenticated onboarding.",
      })
      .select("id,status,verification_level,provider,external_id,expires_at")
      .single();

    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error?.message || "Unable to create Local verification case." },
        { status: 500 }
      );
    }
    current = created.data;
  }

  if (!["pending", "in_review", "not_started"].includes(current.status)) {
    return NextResponse.json(
      { error: "This Local verification case cannot be restarted. Contact SafariPlug support." },
      { status: 409 }
    );
  }

  const externalUserId = `safariplug:${current.id}`;
  const token = await createSumsubAccessToken({
    userId: externalUserId,
    email: user.email,
    phone: user.phone,
  });

  if (!token.token) {
    return NextResponse.json({ error: "Sumsub did not return an access token." }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("verification_cases")
    .update({
      provider: "sumsub",
      external_id: externalUserId,
      verification_level: "enhanced",
      status: current.status === "not_started" ? "pending" : current.status,
    })
    .eq("id", current.id);

  if (updateError) {
    return NextResponse.json({ error: "Unable to link the Local verification session." }, { status: 500 });
  }

  await supabaseAdmin
    .from("local_profiles")
    .update({ verification_state: "pending", service_status: "pending_review" })
    .eq("id", profile.id)
    .neq("verification_state", "verified");

  return NextResponse.json({
    accessToken: token.token,
    userId: token.userId,
    levelName: sumsubVerificationLevel,
    caseId: current.id,
  });
}
