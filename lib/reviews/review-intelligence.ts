import crypto from "node:crypto";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TravelReviewProduct } from "@/lib/reviews/travel-review-eligibility";

type Metadata = Record<string, unknown>;

function record(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Metadata : {};
}

export function travelReviewProductIdentity(product: TravelReviewProduct, metadata: Metadata) {
  if (product === "hotel") {
    const productName = String(metadata.hotelName || metadata.propertyName || "").trim() || null;
    const provider = String(metadata.provider || "hotel").trim().toLowerCase() || "hotel";
    const explicit = String(metadata.hotelCode || metadata.hotelId || metadata.propertyId || metadata.hotel_id || "").trim();
    const fallback = productName ? provider + ":name:" + productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
    const productRef = explicit || fallback || null;
    return { productRef, productName, provider };
  }
  if (product === "activity") {
    const activity = record(metadata.activity);
    const productRef = String(activity.code || metadata.activityCode || "").trim() || null;
    const productName = String(activity.name || metadata.activityName || "").trim() || null;
    return { productRef, productName, provider: "hotelbeds" };
  }
  const route = record(metadata.route);
  const from = record(route.from);
  const to = record(route.to);
  const service = record(metadata.service);
  const fromCode = String(from.code || "").trim();
  const toCode = String(to.code || "").trim();
  const serviceName = String(service.vehicleName || service.transferType || "Transfer").trim();
  const productRef = fromCode && toCode ? [fromCode,toCode,serviceName].join(":") : null;
  const productName = fromCode && toCode ? `${fromCode} → ${toCode} · ${serviceName}` : serviceName || null;
  return { productRef, productName, provider: "hotelbeds" };
}

export async function getGroundedReviewSummary(input: {
  productType: "service" | TravelReviewProduct;
  businessId?: string | null;
  provider?: string | null;
  productRef?: string | null;
}) {
  let query = supabaseAdmin
    .from("traveler_reviews")
    .select("id,rating,dimensions,title,body,created_at")
    .eq("product_type", input.productType)
    .eq("moderation_status", "approved")
    .eq("verified_booking", true)
    .order("created_at", { ascending: false })
    .limit(40);

  if (input.businessId) query = query.eq("business_id", input.businessId);
  else if (input.productRef) {
    query = query.eq("product_ref", input.productRef);
    if (input.provider) query = query.eq("provider", input.provider);
  } else return null;

  const { data, error } = await query;
  if (error) throw error;
  const reviews = data || [];
  if (reviews.length < 3 || !process.env.OPENAI_API_KEY) return null;

  const source = reviews.map((review:any) => ({
    id: review.id,
    rating: Number(review.rating || 0),
    dimensions: review.dimensions || {},
    title: review.title || null,
    body: review.body || null,
  }));
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify(source)).digest("hex");
  const provider = input.provider || "";
  const productRef = input.productRef || "";

  let cache = supabaseAdmin
    .from("traveler_review_summaries")
    .select("summary,source_hash,review_count,generated_at")
    .eq("product_type", input.productType)
    .eq("provider", provider)
    .eq("product_ref", productRef);
  cache = input.businessId ? cache.eq("business_id", input.businessId) : cache.is("business_id", null);
  const { data: cached } = await cache.maybeSingle();
  if (cached?.source_hash === sourceHash && cached.summary) return cached;

  const response = await openai.responses.create({
    model: process.env.OPENAI_REVIEW_SUMMARY_MODEL || "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: "Summarize only the verified SafariPlug reviews provided. Do not infer facts not stated in the reviews. Mention recurring positives and recurring cautions only when supported by multiple reviews. Never invent amenities, awards, safety claims, availability, pricing, or sentiment. Keep the summary to 2-3 concise sentences and say 'Verified traveler reviews' rather than implying all customers agree.",
      },
      { role: "user", content: JSON.stringify(source) },
    ],
  });
  const summary = response.output_text?.trim();
  if (!summary) return null;

  const { data: saved, error: saveError } = await supabaseAdmin
    .from("traveler_review_summaries")
    .upsert({
      product_type: input.productType,
      provider,
      product_ref: productRef,
      business_id: input.businessId || null,
      review_count: reviews.length,
      source_hash: sourceHash,
      summary,
      generated_at: new Date().toISOString(),
    }, { onConflict: "product_type,provider,product_ref,business_id" })
    .select("summary,source_hash,review_count,generated_at")
    .single();
  if (saveError) throw saveError;
  return saved;
}
