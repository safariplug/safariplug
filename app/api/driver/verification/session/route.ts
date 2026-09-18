import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createSumsubAccessToken,
  sumsubConfigured,
  sumsubVerificationLevel,
} from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json(
      { error: "A confirmed SafariPlug driver account is required." },
      { status: 401 }
    );
  }

  if (!sumsubConfigured()) {
    return NextResponse.json(
      {
        error:
          "Driver identity/liveness verification is not configured yet. SafariPlug will not simulate approval.",
      },
      { status: 503 }
    );
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,verification_state,service_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (driverError) {
    return NextResponse.json({ error: driverError.message }, { status: 500 });
  }
  if (!driver) {
    return NextResponse.json({ error: "Driver application not found." }, { status: 404 });
  }

  let { data: current, error: caseError } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,notes,expires_at")
    .eq("subject_type", "driver")
    .eq("subject_id", driver.id)
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
    return NextResponse.json(
      { error: "Driver identity/liveness verification is already approved." },
      { status: 409 }
    );
  }

  if (!current) {
    const created = await supabaseAdmin
      .from("verification_cases")
      .insert({
        subject_type: "driver",
        subject_id: driver.id,
        status: "pending",
        verification_level: "enhanced",
        provider: "sumsub",
        notes:
          "Driver identity and live face/liveness verification initiated from the authenticated driver portal.",
      })
      .select("id,status,verification_level,provider,external_id,notes,expires_at")
      .single();

    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error?.message || "Unable to create driver verification case." },
        { status: 500 }
      );
    }
    current = created.data;
  }

  if (!["pending", "in_review", "not_started"].includes(current.status)) {
    return NextResponse.json(
      {
        error:
          "This driver verification case cannot be restarted. Resolve the current verification case with SafariPlug support.",
      },
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
    return NextResponse.json(
      { error: "Sumsub did not return an access token." },
      { status: 502 }
    );
  }

  const previousNote =
    typeof current.notes === "string" && current.notes.trim()
      ? current.notes.trim()
      : "";
  const livenessNote =
    "Driver live identity/liveness verification started. Existing document evidence remains separate and must still satisfy SafariPlug compliance gates.";

  const { error: updateError } = await supabaseAdmin
    .from("verification_cases")
    .update({
      provider: "sumsub",
      external_id: externalUserId,
      verification_level: "enhanced",
      status: current.status === "not_started" ? "pending" : current.status,
      notes: previousNote.includes(livenessNote)
        ? previousNote
        : [previousNote, livenessNote].filter(Boolean).join(" "),
    })
    .eq("id", current.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Unable to link the driver verification session." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    accessToken: token.token,
    userId: token.userId,
    levelName: sumsubVerificationLevel,
    caseId: current.id,
  });
}
