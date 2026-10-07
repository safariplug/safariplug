
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const reviewId = String(body?.reviewId || "").trim();
  const reason = String(body?.reason || "").trim().slice(0, 120);
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 1500) : "";
  if (!reviewId || !reason) return NextResponse.json({ error: "Review and report reason are required." }, { status: 400 });

  const { data: review, error: reviewError } = await supabaseAdmin
    .from("traveler_reviews")
    .select("id,moderation_status")
    .eq("id", reviewId)
    .eq("moderation_status", "approved")
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Public review not found." }, { status: 404 });

  const { error } = await supabaseAdmin.from("traveler_review_reports").upsert({
    review_id: reviewId,
    reporter_id: user.id,
    reason,
    details: details || null,
    status: "open",
    resolved_at: null,
  }, { onConflict: "review_id,reporter_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("traveler_reviews").update({
    reported_at: new Date().toISOString(),
    report_reason: reason,
  }).eq("id", reviewId).eq("moderation_status", "approved");

  return NextResponse.json({ success: true });
}
