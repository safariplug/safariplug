"use server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { scoreProspect } from "./scoring";
import { supplyAcquisitionPriority, supplyGapPriority, supplyMarketReadiness } from "@/lib/services/supply-market-readiness";

export type SalesScoutFormState = { status: "idle" | "success" | "error"; message: string };

const SCOUT_CITIES = [
  "Nairobi","Mombasa","Diani","Kilifi","Malindi","Watamu","Lamu","Zanzibar","Kampala",
  "Dar es Salaam","Accra","Lagos","Cape Town","Johannesburg","Cairo","Casablanca",
] as const;

const SCOUT_CATEGORIES = [
  "Barbers","Hair & Beauty","Spas & Massage","Tattoo Artists & Body Art","Nails","Lashes & Brows",
  "Fitness & Personal Training","Yoga/Pilates/Mindfulness","Diving & Marine","Surfing & Board Sports",
  "Water Sports & Kite","Tours & Local Guides","Photography & Content","Private Chefs & Cooking",
  "Hotels","Restaurants","Nightlife","Tour Operators","Experiences","Beach Clubs","Airport Transfer Operators",
] as const;

// Automated discovery should first fill the inventory a traveler needs to complete a trip.
// Broader local-service categories remain available for manual scouting in the admin UI.
const SCHEDULED_SUPPLIER_CATEGORIES = [
  "Hotels",
  "Experiences",
  "Tour Operators",
  "Tours & Local Guides",
  "Restaurants",
  "Airport Transfer Operators",
  "Beach Clubs",
  "Diving & Marine",
  "Water Sports & Kite",
  "Surfing & Board Sports",
  "Nightlife",
] as const;

const SCHEDULED_PRIORITY_CITIES = [
  "Nairobi","Mombasa","Diani","Kilifi","Malindi","Watamu","Lamu","Zanzibar","Kampala",
] as const;

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

async function enqueue(city: string, category: string, options?: { dedupeHours?: number }) {
  const dedupeHours = Math.max(0, Number(options?.dedupeHours || 0));

  if (dedupeHours > 0) {
    const cutoff = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("supplier_scout_jobs")
      .select("id,status,created_at")
      .eq("city", city)
      .eq("category", category)
      .in("status", ["queued","running","completed"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return { id: existing.id as string, created: false, status: String(existing.status) };
  }

  const { data, error } = await supabaseAdmin
    .from("supplier_scout_jobs")
    .insert({ city, category, status: "queued", queued_at: new Date().toISOString() })
    .select("id,status")
    .single();

  if (error) throw error;
  return { id: data.id as string, created: true, status: String(data.status) };
}

export async function runSalesScout(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    if (e instanceof AdminAuthError) throw new Error(e.message);
    throw new Error(e instanceof Error ? e.message : "Request failed");
  }

  const city = clean(formData.get("city")) || "Nairobi";
  const category = clean(formData.get("category")) || "Hotels";

  if (
    !SCOUT_CITIES.includes(city as typeof SCOUT_CITIES[number]) ||
    !SCOUT_CATEGORIES.includes(category as typeof SCOUT_CATEGORIES[number])
  ) throw new Error("Invalid Supplier Scout city or category");

  const queued = await enqueue(city, category);
  revalidatePath("/admin/ai-sales");
  return { jobId: queued.id, city, category, created: queued.created };
}

export async function runSalesScoutForm(
  _previous: SalesScoutFormState,
  formData: FormData,
): Promise<SalesScoutFormState> {
  try {
    const r = await runSalesScout(formData);
    return {
      status: "success",
      message: `${r.created ? "Supplier Scout queued" : "Supplier Scout already has a recent job"} for ${r.category} in ${r.city}. You can leave this page; discovery will continue in the background. Job ${r.jobId.slice(0,8)}.`,
    };
  } catch (e: unknown) {
    console.error("SUPPLIER SCOUT QUEUE ERROR", e);
    return {
      status: "error",
      message: `Supplier Scout failed to queue: ${e instanceof Error ? e.message : "Request failed"}`,
    };
  }
}

export async function runScheduledSalesScout() {
  if (process.env.SUPPLIER_SCOUT_AUTOMATION_ENABLED !== "true") {
    return {
      paused: true,
      reason: "Supplier Scout automation is paused to control AI API spend. Set SUPPLIER_SCOUT_AUTOMATION_ENABLED=true to resume.",
      queued: 0,
      skipped: 0,
      jobs: [] as string[],
      selected: [] as Array<{ city: string; category: string; score: number; supplyGap?: number; uncoveredGap?: number; pipeline?: number; activated?: number; target?: number }>,
    };
  }

  const [{ data: prospectRows, error: prospectError }, { data: supplierRows, error: supplierError }] = await Promise.all([
    supabaseAdmin
      .from("ai_sales_prospects")
      .select("id,city,category,status,review_status")
      .in("city", [...SCHEDULED_PRIORITY_CITIES])
      .limit(2000),
    supabaseAdmin
      .from("supplier_accounts")
      .select("id,prospect_id,onboarding_status")
      .in("onboarding_status", ["approved","live"])
      .not("prospect_id","is",null)
      .limit(2000),
  ]);
  if (prospectError || supplierError) throw prospectError || supplierError;

  const prospectById = new Map((prospectRows || []).map((prospect: any) => [String(prospect.id), prospect]));
  const activatedPartners = (supplierRows || []).flatMap((supplier: any) => {
    const prospect = prospectById.get(String(supplier.prospect_id || ""));
    return prospect ? [{ city: prospect.city as string | null, category: prospect.category as string | null }] : [];
  });
  const readinessRows = supplyMarketReadiness({
    cities: [...SCHEDULED_PRIORITY_CITIES],
    prospects: (prospectRows || []).map((prospect: any) => ({
      city: prospect.city,
      category: prospect.category,
      review_status: prospect.review_status,
      status: prospect.status,
    })),
    activatedPartners,
  });
  const gapPriority = new Map(
    supplyGapPriority(readinessRows).map((row, index) => [`${row.city}:${row.category}`, { row, index }]),
  );
  const acquisitionKeys = new Set(supplyAcquisitionPriority(readinessRows).map((row) => `${row.city}:${row.category}`));

  const pairs = SCHEDULED_PRIORITY_CITIES
    .flatMap((city) =>
      SCHEDULED_SUPPLIER_CATEGORIES.map((category) => {
        const base = scoreProspect({ business_name: "Scheduled discovery", city, category }).score;
        const gap = gapPriority.get(`${city}:${category}`);
        const gapBoost = gap ? Math.min(25, Math.round((gap.row.gap / gap.row.target) * 25)) : 0;
        return {
          city,
          category,
          score: Math.min(100, base + gapBoost),
          supplyGap: gap?.row.gap || 0,
          uncoveredGap: gap?.row.uncoveredGap || 0,
          pipeline: gap?.row.pipeline || 0,
          activated: gap?.row.livePartners || 0,
          target: gap?.row.target || 0,
        };
      }),
    )
    .filter((pair) => pair.score >= 70 && acquisitionKeys.has(`${pair.city}:${pair.category}`))
    .sort((a, b) => b.uncoveredGap - a.uncoveredGap || b.supplyGap - a.supplyGap || b.score - a.score || a.city.localeCompare(b.city) || a.category.localeCompare(b.category));

  if (!pairs.length) {
    return { paused: false, queued: 0, skipped: 0, jobs: [] as string[], selected: [] };
  }

  const selected: typeof pairs = [];
  const cityCounts = new Map<string,number>();
  for (const pair of pairs) {
    if (selected.length >= 5) break;
    const count = cityCounts.get(pair.city) || 0;
    if (count >= 2) continue;
    selected.push(pair);
    cityCounts.set(pair.city,count+1);
  }

  const jobs: string[] = [];
  let queued = 0;
  let skipped = 0;

  for (const pair of selected) {
    const result = await enqueue(pair.city, pair.category, { dedupeHours: 24 });
    jobs.push(result.id);
    if (result.created) queued += 1;
    else skipped += 1;
  }

  return {
    paused: false,
    queued,
    skipped,
    jobs,
    selected: selected.map(({ city, category, score, supplyGap, uncoveredGap, pipeline, activated, target }) => ({ city, category, score, supplyGap, uncoveredGap, pipeline, activated, target })),
  };
}
