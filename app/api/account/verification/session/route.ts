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
      { error: "A confirmed SafariPlug account is required." },
      { status: 401 }
    );
  }

  if (!sumsubConfigured()) {
    return NextResponse.json(
      {
        error:
          "Traveler identity/liveness verification is not configured yet. SafariPlug will not simulate approval.",
      },
      { status: 503 }
    );
  }

  const { data: current } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,expires_at")
    .eq("subject_type", "traveler")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { error: "Start traveler verification first." },
      { status: 404 }
    );
  }

  if (
    current.status === "approved" &&
    (!current.expires_at || new Date(current.expires_at) > new Date())
  ) {
    return NextResponse.json(
      { error: "Traveler verification is already approved." },
      { status: 409 }
    );
  }

  if (!["pending", "in_review", "not_started"].includes(current.status)) {
    return NextResponse.json(
      {
        error:
          "This traveler verification case cannot be restarted. Contact SafariPlug support.",
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

  if (current.external_id !== externalUserId || current.provider !== "sumsub") {
    const { error } = await supabaseAdmin
      .from("verification_cases")
      .update({
        provider: "sumsub",
        external_id: externalUserId,
        verification_level: "enhanced",
        status: current.status === "not_started" ? "pending" : current.status,
      })
      .eq("id", current.id);

    if (error) {
      return NextResponse.json(
        { error: "Unable to link the traveler verification session." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    accessToken: token.token,
    userId: token.userId,
    levelName: sumsubVerificationLevel,
  });
}
