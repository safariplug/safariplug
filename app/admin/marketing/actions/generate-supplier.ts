"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supplierGrowthRecommendations, supplierPerformanceScore } from "@/lib/services/supplier-performance-scorecard";
import { revalidatePath } from "next/cache";

type Platform = "instagram" | "whatsapp" | "newsletter";

export async function generateSupplierMarketingDraft({
  supplierId,
  platform,
}: {
  supplierId: string;
  platform: Platform;
}) {
  await requireAdmin();
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,prospect_id,onboarding_status,businesses!inner(id,name,description,status,website_url,instagram_url,slug,service_profiles(id,status,booking_status,service_offerings(id,name,status,price,currency,duration_minutes),service_staff(id,status,service_staff_availability(id,is_active))))")
    .eq("id", supplierId)
    .maybeSingle();

  if (supplierError || !supplier) throw new Error(supplierError?.message || "Supplier not found.");
  if (!["approved", "live"].includes(String(supplier.onboarding_status || ""))) throw new Error("Only approved/live suppliers can enter merchandising.");

  const business = supplier.businesses as any;
  const profiles = Array.isArray(business?.service_profiles) ? business.service_profiles : business?.service_profiles ? [business.service_profiles] : [];
  const profileIds = profiles.map((profile: any) => String(profile.id));
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: appointments }, { data: payoutIssues }, { data: qualityTasks }, { data: prospect }] = await Promise.all([
    profileIds.length
      ? supabaseAdmin.from("service_appointments").select("id,status,service_profile_id").in("service_profile_id", profileIds).gte("created_at", since).limit(1000)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from("service_provider_payouts").select("id").eq("provider_user_id", supplier.user_id).in("status", ["held","failed","processing"]).gte("updated_at", since).limit(100),
    supplier.prospect_id
      ? supabaseAdmin.from("crm_followups").select("id").eq("prospect_id", supplier.prospect_id).eq("status", "open").ilike("title", "[Supplier quality]%").limit(100)
      : Promise.resolve({ data: [] as any[] }),
    supplier.prospect_id
      ? supabaseAdmin.from("ai_sales_prospects").select("city,category").eq("id", supplier.prospect_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rows = appointments || [];
  const completed = rows.filter((row: any) => row.status === "completed").length;
  const cancelled = rows.filter((row: any) => row.status === "cancelled").length;
  const noShow = rows.filter((row: any) => row.status === "no_show").length;
  const bookingStatusOpen = profiles.length > 0 && profiles.every((profile: any) => profile.status === "active" && profile.booking_status === "open");

  const staff = profiles.flatMap((profile: any) => Array.isArray(profile.service_staff) ? profile.service_staff : profile.service_staff ? [profile.service_staff] : []);
  const activeAvailabilityCount = staff
    .filter((member: any) => member.status === "active")
    .flatMap((member: any) => Array.isArray(member.service_staff_availability) ? member.service_staff_availability : member.service_staff_availability ? [member.service_staff_availability] : [])
    .filter((slot: any) => slot.is_active === true).length;

  const offerings = profiles
    .flatMap((profile: any) => Array.isArray(profile.service_offerings) ? profile.service_offerings : profile.service_offerings ? [profile.service_offerings] : [])
    .filter((offering: any) => offering.status === "active" && Number(offering.price || 0) > 0 && Number(offering.duration_minutes || 0) > 0);

  const performance = supplierPerformanceScore({
    bookingStatusOpen,
    activeAvailabilityCount,
    payoutAccountVerified: (payoutIssues || []).length === 0,
    payoutIssueCount: (payoutIssues || []).length,
    completed,
    cancelled,
    noShow,
    openQualityIssues: (qualityTasks || []).length,
  });

  const recommendations = supplierGrowthRecommendations({
    score: performance.score,
    bookingStatusOpen,
    activeAvailabilityCount,
    activeOfferingCount: offerings.length,
    bookings30d: rows.length,
    completionRate: performance.completionRate,
    failureRate: performance.failureRate,
    payoutIssueCount: (payoutIssues || []).length,
    openQualityIssues: (qualityTasks || []).length,
  });

  const highPriority = recommendations.filter((item) => item.priority === "high");
  const eligibleRecommendation = recommendations.find((item) => ["promote_supplier", "build_demand"].includes(item.key));
  if (highPriority.length || !eligibleRecommendation) {
    throw new Error("This supplier is not currently eligible for marketing. Resolve operational/finance issues first or wait for stronger merchandising evidence.");
  }

  const { data: existing } = await supabaseAdmin
    .from("marketing_drafts")
    .select("id,status,publish_status,metricool_status")
    .is("event_id", null)
    .eq("event_name", business.name)
    .eq("platform", platform)
    .eq("content_type", "supplier_campaign")
    .neq("status", "rejected")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    throw new Error(`A ${platform} supplier campaign already exists for ${business.name} (campaign #${existing.id}).`);
  }

  const offeringFacts = offerings.slice(0, 5).map((item: any) => {
    const price = item.price != null ? `${item.currency || "KES"} ${item.price}` : "price not recorded";
    return `${item.name} — ${price}`;
  });

  const prompt = [
    `Create one ${platform} marketing draft for an approved SafariPlug supplier.`,
    "Use only the supplied facts. Never invent awards, ratings, amenities, popularity, guest quotes, availability dates, discounts, or guarantees.",
    "This is a merchandising draft that requires human approval before publication.",
    "Do not mention internal scores, performance bands, cancellation rates, payout state, or internal recommendation logic.",
    `Supplier: ${business.name}`,
    `Category: ${prospect?.category || "Local travel service"}`,
    `City: ${prospect?.city || "Location not recorded"}`,
    `Description: ${business.description || "No approved description recorded"}`,
    `Active offerings: ${offeringFacts.length ? offeringFacts.join("; ") : "No approved offering details supplied"}`,
    `Commercial objective: ${eligibleRecommendation.title} — ${eligibleRecommendation.detail}`,
    business.website_url ? `Website: ${business.website_url}` : "",
    business.instagram_url ? `Instagram: ${business.instagram_url}` : "",
    "Write concise, useful travel copy with a clear SafariPlug discovery/booking call to action. Keep it factual and specific.",
  ].filter(Boolean).join("\n");

  const response = await openai.responses.create({
    model: process.env.OPENAI_MARKETING_MODEL || "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: "You are Amani, SafariPlug's Marketing & Growth AI Director. Create evidence-backed supplier merchandising drafts only. Never publish or trigger external actions.",
      },
      { role: "user", content: prompt },
    ],
  });

  const generatedCopy = response.output_text?.trim();
  if (!generatedCopy) throw new Error("Amani returned an empty supplier campaign.");

  const externalUrl = business.website_url || (business.slug ? `https://www.safariplug.com/services/${business.slug}` : null);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("marketing_drafts")
    .insert({
      event_id: null,
      event_name: business.name,
      city: prospect?.city || "",
      platform,
      content_type: "supplier_campaign",
      draft_content: generatedCopy,
      creative_brief: `Supplier merchandising: ${eligibleRecommendation.key}`,
      image_url: null,
      video_url: null,
      external_url: externalUrl,
      status: "draft",
      publish_status: "not_ready",
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/admin/marketing");
  revalidatePath("/admin/ai-sales/partners");
  revalidatePath(`/admin/ai-sales/partners/${supplierId}`);

  return {
    success: true as const,
    draftId: inserted?.id ?? null,
    generatedCopy,
    supplierName: business.name,
    recommendation: eligibleRecommendation.key,
  };
}
