import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function supplierContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  const { data: account } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  return account ? { user, account } : null;
}

export async function GET() {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("traveler_reviews")
    .select("id,product_type,source_id,rating,dimensions,title,body,verified_booking,moderation_status,supplier_response,supplier_responded_at,created_at,updated_at")
    .eq("business_id", ctx.account.business_id)
    .eq("moderation_status", "approved")
    .eq("verified_booking", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const reviewId = String(body?.reviewId || "").trim();
  const response = typeof body?.response === "string" ? body.response.trim().slice(0, 2000) : "";

  if (!reviewId) return NextResponse.json({ error: "Review is required." }, { status: 400 });
  if (!response) return NextResponse.json({ error: "Provider response is required." }, { status: 400 });

  const { data: review, error: reviewError } = await supabaseAdmin
    .from("traveler_reviews")
    .select("id,business_id,moderation_status")
    .eq("id", reviewId)
    .eq("business_id", ctx.account.business_id)
    .maybeSingle();

  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.moderation_status !== "approved") {
    return NextResponse.json({ error: "Only approved public reviews can receive a provider response." }, { status: 409 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("traveler_reviews")
    .update({
      supplier_response: response,
      supplier_responded_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("business_id", ctx.account.business_id)
    .select("id,supplier_response,supplier_responded_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: updated });
}
