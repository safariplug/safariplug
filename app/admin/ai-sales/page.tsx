import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SupplierScoutForm } from "./supplier-scout-form";
import { startOutreachForAllApproved } from "./bulk-outreach";
import { approveSelectedSalesProspects } from "./bulk-review";
import { salesProspectQualityIssues } from "@/lib/services/sales-prospect-quality";
import { BulkReviewSelectionControls } from "./bulk-review-selection-controls";
import { citySupplySummary, supplyAcquisitionPriority, supplyGapPriority, supplyMarketReadiness } from "@/lib/services/supply-market-readiness";

type SearchParams = {
  stage?: string;
  city?: string;
  category?: string;
  contact?: string;
  sort?: string;
  outreach?: string;
  bulk_review?: string;
};

type Prospect = {
  id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  opportunity_score: number | null;
  status: string;
  review_status: string;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  source_url: string | null;
  source_name: string | null;
  created_at: string;
};

const reviewStages = new Set(["pending_review", "approved", "rejected", "all"]);
const contactFilters = new Set(["all", "email", "any", "missing"]);
const sortModes = new Set(["score", "newest", "name"]);

export default async function AISalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const stage = reviewStages.has(params.stage || "") ? String(params.stage) : "pending_review";
  const city = String(params.city || "");
  const category = String(params.category || "");
  const contact = contactFilters.has(params.contact || "") ? String(params.contact) : (stage === "pending_review" ? "email" : "all");
  const sort = sortModes.has(params.sort || "") ? String(params.sort) : "score";
  const outreachMessage = String(params.outreach || "");
  const bulkReviewMessage = String(params.bulk_review || "");

  const [
    { count: total },
    { count: pending },
    { count: partners },
    { count: invites },
    { count: signupStarted },
    invitationLinks,
    prospectQuery,
    scoutJobsQuery,
    supplierAccountsQuery,
  ] = await Promise.all([
    supabaseAdmin.from("ai_sales_prospects").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("ai_sales_prospects").select("*", { count: "exact", head: true }).eq("review_status", "pending_review"),
    supabaseAdmin.from("safari_partners").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("partner_invitations").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("partner_invitations").select("*", { count: "exact", head: true }).in("status", ["signup_started", "onboarding"]),
    supabaseAdmin.from("partner_invitations").select("prospect_id").not("prospect_id", "is", null).limit(500),
    supabaseAdmin
      .from("ai_sales_prospects")
      .select("id,business_name,category,city,opportunity_score,status,review_status,contact_email,phone,website,instagram,facebook,source_url,source_name,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("supplier_scout_jobs")
      .select("id,city,category,status,created_at,queued_at,completed_at,last_error,qualified_count,contact_ready_count,inserted_count")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("supplier_accounts")
      .select("id,prospect_id,onboarding_status")
      .in("onboarding_status", ["approved","live"])
      .not("prospect_id","is",null)
      .limit(1000),
  ]);

  const allProspects = (prospectQuery.data || []) as Prospect[];
  const invitedProspectIds = new Set((invitationLinks.data || []).map((row) => row.prospect_id).filter(Boolean) as string[]);
  const cities = [...new Set(allProspects.map((p) => p.city).filter((value): value is string => Boolean(value)))].sort();
  const categories = [...new Set(allProspects.map((p) => p.category).filter((value): value is string => Boolean(value)))].sort();
  const prospectById = new Map(allProspects.map((prospect) => [prospect.id, prospect]));
  const activatedPartners = (supplierAccountsQuery.data || []).flatMap((supplier: any) => {
    const prospect = prospectById.get(String(supplier.prospect_id || ""));
    return prospect ? [{ city: prospect.city, category: prospect.category }] : [];
  });
  const prioritySupplyCities = ["Nairobi","Mombasa","Diani","Kilifi","Malindi","Watamu","Lamu","Zanzibar","Kampala"];
  const supplyRows = supplyMarketReadiness({
    cities: prioritySupplyCities,
    prospects: allProspects,
    activatedPartners,
  });
  const supplyCities = citySupplySummary(supplyRows);
  const topSupplyGaps = supplyGapPriority(supplyRows).slice(0, 8);
  const topAcquisitionGaps = supplyAcquisitionPriority(supplyRows).slice(0, 8);
  const pipelineCoveredMarkets = supplyCities.filter((market) => market.status === "pipeline_covered").length;

  const hasAnyContact = (p: Prospect) => Boolean(p.contact_email || p.phone || p.website || p.instagram || p.facebook);
  let filtered = allProspects.filter((p) => {
    if (stage !== "all" && p.review_status !== stage) return false;
    if (city && p.city !== city) return false;
    if (category && p.category !== category) return false;
    if (contact === "email" && !p.contact_email) return false;
    if (contact === "any" && !hasAnyContact(p)) return false;
    if (contact === "missing" && hasAnyContact(p)) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "name") return a.business_name.localeCompare(b.business_name);
    const score = Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0);
    return score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const visible = filtered.slice(0, 100);
  const qualityReadyVisibleIds = visible
    .filter((p) => p.review_status === "pending_review" && Boolean(p.contact_email) && salesProspectQualityIssues(p).length === 0)
    .map((p) => p.id);
  const reviewReady = allProspects.filter((p) => p.review_status === "pending_review" && Boolean(p.contact_email)).length;
  const approvedUninvited = allProspects.filter((p) => p.review_status === "approved" && p.status !== "rejected" && !invitedProspectIds.has(p.id));
  const outreachReady = approvedUninvited.filter((p) => Boolean(p.contact_email)).length;
  const contactReviewNeeded = approvedUninvited.filter((p) => !p.contact_email).length;
  const supplierScoutAutomationEnabled = process.env.SUPPLIER_SCOUT_AUTOMATION_ENABLED === "true";
  const supplierScoutWorkerConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const scoutJobs = (scoutJobsQuery.data || []) as Array<{
    id: string;
    city: string;
    category: string;
    status: string;
    created_at: string;
    queued_at: string | null;
    completed_at: string | null;
    last_error: string | null;
    qualified_count: number | null;
    contact_ready_count: number | null;
    inserted_count: number | null;
  }>;
  const latestScoutJob = scoutJobs[0] || null;
  const activeScoutJobs = scoutJobs.filter((job) => ["queued", "running"].includes(job.status)).length;
  const failedScoutJobs = scoutJobs.filter((job) => job.status === "failed").length;
  const completedScoutJobs = scoutJobs.filter((job) => job.status === "completed").length;
  const supplierScoutHealthy = supplierScoutAutomationEnabled && supplierScoutWorkerConfigured && !scoutJobsQuery.error;

  return (
    <main className="min-h-screen bg-gray-50 p-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-blue-600 hover:underline">← Back to Admin</Link>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-gray-400">Partner Growth</p>
              <h1 className="mt-2 text-3xl font-bold">SafariPlug AI Sales Agent</h1>
              <p className="mt-2 text-gray-600">Discover, review, recruit and move real partners into SafariPlug onboarding.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/crm" className="rounded-xl border px-5 py-3 font-semibold">CRM 2.0</Link>
              <Link href="/admin/ai-sales/invitations" className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black">Governed outreach</Link>
              <Link href="/admin/ai-sales/partners" className="rounded-xl bg-black px-5 py-3 text-white">Partner operations →</Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Prospects", total],
              ["Pending review", pending],
              ["Review-ready", reviewReady],
              ["CRM partners", partners],
              ["Invitations", invites],
              ["Onboarding", signupStarted],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-3xl font-bold">{Number(value) || 0}</p>
              </div>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-300/70">Supply Command Center</p>
                <h2 className="mt-1 text-2xl font-semibold">Destination launch readiness</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Tracks direct SafariPlug partner density across the trip-critical categories. This is a supply-acquisition signal, not a claim that external hotel/activity inventory is unavailable.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">{activatedPartners.length} activated direct partner{activatedPartners.length===1?"":"s"} linked to Scout prospects</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {supplyCities.slice(0,9).map((market) => <div key={market.city} className="rounded-xl border border-white/10 bg-white/[.04] p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{market.city}</p><p className="mt-1 text-xs text-white/40">{market.pipeline} pipeline prospect{market.pipeline===1?"":"s"} · {market.uncoveredGap} uncovered gap</p></div><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase "+(market.status==="launch_ready"?"bg-emerald-500/20 text-emerald-300":market.status==="pipeline_covered"?"bg-blue-500/20 text-blue-300":market.status==="building"?"bg-amber-500/20 text-amber-300":"bg-red-500/20 text-red-300")}>{market.status.replaceAll("_"," ")}</span></div>
                <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-300" style={{width:`${market.readiness}%`}} /></div><strong className="text-sm">{market.readiness}%</strong></div>
              </div>)}
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/35">Autonomous acquisition priorities</p><p className="mt-1 text-sm text-white/55">Scout now ignores gaps already covered by enough active prospects and concentrates discovery on uncovered launch targets.</p></div><div className="flex items-center gap-3"><span className="text-xs text-blue-300">{pipelineCoveredMarkets} market{pipelineCoveredMarkets===1?"":"s"} pipeline-covered</span><Link href="#scout" className="text-xs font-semibold text-amber-300">Open Scout →</Link></div></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{topAcquisitionGaps.map((gap)=><Link key={`${gap.city}:${gap.category}`} href={`/admin/ai-sales?stage=all&city=${encodeURIComponent(gap.city)}&category=${encodeURIComponent(gap.category)}#prospect-feed`} className="rounded-lg border border-white/10 p-3 hover:border-amber-300/40"><p className="text-sm font-semibold">{gap.city}</p><p className="mt-1 text-xs text-white/50">{gap.category}</p><p className="mt-2 text-[11px] text-amber-300">{gap.livePartners}/{gap.target} activated · {gap.pipelineCoveredGap} gap covered by pipeline · {gap.uncoveredGap} still uncovered</p></Link>)}</div>
              {!topAcquisitionGaps.length&&topSupplyGaps.length>0?<p className="mt-3 text-sm text-blue-200">All current launch gaps have enough pipeline coverage. Supplier Scout can avoid unnecessary discovery while activation work catches up.</p>:null}
            </div>
          </section>

          <section className={`mt-8 rounded-xl border p-5 ${supplierScoutHealthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-gray-500">AI supplier engine health</p>
                <h2 className="mt-1 text-xl font-semibold">{supplierScoutHealthy ? "Autonomous Supplier Scout is ready" : "Supplier Scout needs attention"}</h2>
                <p className="mt-2 max-w-3xl text-sm text-gray-600">
                  {supplierScoutHealthy
                    ? "Scheduled discovery can queue trip-ready suppliers and the worker credential is configured. Human approval is still required before outreach."
                    : !supplierScoutAutomationEnabled
                      ? "Scheduled supplier discovery is paused. Set SUPPLIER_SCOUT_AUTOMATION_ENABLED=true in the hosting environment to resume autonomous scouting."
                      : !supplierScoutWorkerConfigured
                        ? "CRON_SECRET is not configured, so scheduled Supplier Scout and worker calls cannot authenticate."
                        : "Supplier Scout job health could not be loaded. Check the database connection and recent worker logs."}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase ${supplierScoutHealthy ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}`}>
                {supplierScoutHealthy ? "Ready" : "Attention"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-gray-500">Active jobs</p><p className="mt-1 text-xl font-bold">{activeScoutJobs}</p></div>
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-gray-500">Completed (recent)</p><p className="mt-1 text-xl font-bold">{completedScoutJobs}</p></div>
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-gray-500">Failed (recent)</p><p className="mt-1 text-xl font-bold">{failedScoutJobs}</p></div>
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-gray-500">Automation</p><p className="mt-1 text-sm font-bold">{supplierScoutAutomationEnabled ? "Enabled" : "Paused"}</p></div>
            </div>
            {latestScoutJob ? (
              <div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-gray-600">
                Latest: <strong>{latestScoutJob.city} · {latestScoutJob.category}</strong> · {latestScoutJob.status.replaceAll("_", " ")}
                {latestScoutJob.status === "completed" ? ` · ${latestScoutJob.inserted_count ?? 0} new prospects` : ""}
                {latestScoutJob.last_error ? <span className="block mt-1 text-red-700">{latestScoutJob.last_error}</span> : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No Supplier Scout job history is available yet.</p>
            )}
          </section>

          <section className="mt-8 grid gap-3 md:grid-cols-3">
            <Link href="#scout" className="rounded-xl border p-5 hover:border-black">
              <h2 className="font-semibold">1. Discover</h2>
              <p className="mt-2 text-sm text-gray-500">Find real prospects with AI Supplier Scout.</p>
            </Link>
            <Link href="#prospect-feed" className="rounded-xl border p-5 hover:border-black">
              <h2 className="font-semibold">2. Review & qualify</h2>
              <p className="mt-2 text-sm text-gray-500">Human approval is required before outreach can be created.</p>
            </Link>
            <Link href="/admin/ai-sales/partners" className="rounded-xl border p-5 hover:border-black">
              <h2 className="font-semibold">3. Recruit & activate</h2>
              <p className="mt-2 text-sm text-gray-500">Govern outreach, onboarding, activation and relationship history.</p>
            </Link>
          </section>

          <section id="scout" className="mt-8 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Africa Supplier Scout</h2>
            <p className="mt-2 text-gray-600">Discovery only: results are reviewed before outreach. The button shows live run status and prevents duplicate submissions.</p>
            <SupplierScoutForm />
          </section>

          <section id="prospect-feed" className="mt-8 rounded-xl border p-6">
            {stage === "pending_review" && contact === "all" && reviewReady > 0 ? (
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-700/70">Fastest path to outreach</p>
                  <p className="mt-1 font-semibold text-amber-950">{reviewReady} pending prospect{reviewReady === 1 ? "" : "s"} already have a business email.</p>
                  <p className="mt-1 text-sm text-amber-900/65">Review these first; approval is still a human decision and nothing is sent automatically.</p>
                </div>
                <Link href="/admin/ai-sales?stage=pending_review&contact=email&sort=score#prospect-feed" className="shrink-0 rounded-xl bg-black px-5 py-3 text-center text-sm font-semibold text-white">Review email-ready prospects →</Link>
              </div>
            ) : null}
            {outreachMessage ? <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{outreachMessage}</div> : null}
            {bulkReviewMessage ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{bulkReviewMessage}</div> : null}
            {stage === "pending_review" && contact === "email" && qualityReadyVisibleIds.length > 0 ? (
              <form id="bulk-prospect-approval" action={approveSelectedSalesProspects} className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-700/70">Batch human review</p>
                  <p className="mt-1 font-semibold text-blue-950">Select quality-ready email prospects below, then approve the checked batch.</p>
                  <p className="mt-1 text-sm text-blue-900/65">SafariPlug re-runs the quality gate server-side, creates governed outreach drafts, and sends nothing.</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <BulkReviewSelectionControls />
                  <button className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Approve selected for outreach</button>
                </div>
              </form>
            ) : null}
            {stage === "approved" && outreachReady > 0 ? (
              <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700/70">Approved and actionable</p>
                  <p className="mt-1 font-semibold text-emerald-950">{outreachReady} approved prospect{outreachReady === 1 ? "" : "s"} have a business email and no invitation yet.</p>
                  <p className="mt-1 text-sm text-emerald-900/65">You can create governed drafts for these approved email-ready prospects at once. Nothing is sent.</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2"><form action={startOutreachForAllApproved}><button className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Start outreach for all approved</button></form><Link href="/admin/ai-sales/invitations" className="rounded-xl border border-emerald-300 px-5 py-3 text-center text-sm font-semibold text-emerald-900">Open outreach drafts →</Link></div>
              </div>
            ) : null}
            {stage === "approved" && contactReviewNeeded > 0 ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-700/70">Contact review needed</p>
                <p className="mt-1 font-semibold text-amber-950">{contactReviewNeeded} approved prospect{contactReviewNeeded === 1 ? "" : "s"} do not have a business email invitation path yet.</p>
                <p className="mt-1 text-sm text-amber-900/65">Review their Organization 360 contact details. A discovered phone number is not treated as WhatsApp automatically.</p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Prospect review queue</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filtered.length} matching prospect{filtered.length === 1 ? "" : "s"} · showing {visible.length}
                  {filtered.length > visible.length ? " highest-priority results" : ""}
                </p>
              </div>
              <Link href="/admin/ai-sales" className="text-sm font-semibold text-blue-600">Reset filters</Link>
            </div>

            <form method="get" className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-5">
              <label className="text-xs font-semibold text-gray-600">
                Review stage
                <select name="stage" defaultValue={stage} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm">
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All stages</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                City
                <select name="city" defaultValue={city} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm">
                  <option value="">All cities</option>
                  {cities.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Category
                <select name="category" defaultValue={category} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm">
                  <option value="">All categories</option>
                  {categories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Contact readiness
                <select name="contact" defaultValue={contact} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm">
                  <option value="email">Business email ready</option>
                  <option value="all">All historical records</option>
                  <option value="any">Any public contact</option>
                  <option value="missing">No public contact</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Sort
                <select name="sort" defaultValue={sort} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm">
                  <option value="score">Opportunity score</option>
                  <option value="newest">Newest first</option>
                  <option value="name">Business name</option>
                </select>
              </label>
              <button className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white md:col-span-5">Apply review filters</button>
            </form>

            <div className="mt-5 space-y-3">
              {visible.map((p) => {
                const approved = p.review_status === "approved" && p.status !== "rejected";
                const publicContact = hasAnyContact(p);
                const outreachStarted = invitedProspectIds.has(p.id);
                const emailOutreachReady = Boolean(p.contact_email);
                const phoneNeedsReview = Boolean(!p.contact_email && p.phone);
                const qualityIssues = salesProspectQualityIssues(p);
                const batchEligible = p.review_status === "pending_review" && emailOutreachReady && qualityIssues.length === 0;
                return (
                  <div key={p.id} className="rounded-xl border p-5">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {batchEligible ? <input form="bulk-prospect-approval" type="checkbox" name="prospect_id" value={p.id} aria-label={`Select ${p.business_name} for bulk approval`} className="h-4 w-4 rounded border-gray-300" /> : null}
                          <h3 className="text-lg font-bold">{p.business_name}</h3>
                          <span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase " + (approved ? "bg-emerald-100 text-emerald-800" : p.review_status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>
                            {p.review_status.replaceAll("_", " ")}
                          </span>
                          {p.contact_email ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase text-blue-700">email ready</span> : publicContact ? <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-600">public contact</span> : <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-600">contact missing</span>}
                        </div>
                        <p className="mt-1 text-gray-600">{p.city || "City not recorded"} · {p.category || "Uncategorized"}</p>
                        <p className="mt-1 text-sm">Opportunity <b>{p.opportunity_score ?? 0}%</b> · pipeline {p.status.replaceAll("_", " ")}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <Link href={`/admin/ai-sales/edit/${p.id}`} className="font-semibold text-blue-600 hover:underline">{approved ? "Open 360 →" : "Review →"}</Link>
                        {approved && outreachStarted ? (
                          <Link href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(p.id)}`} className="font-semibold text-emerald-700 hover:underline">Open outreach →</Link>
                        ) : approved && emailOutreachReady ? (
                          <Link href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(p.id)}`} className="font-semibold text-amber-700 hover:underline">Start outreach →</Link>
                        ) : approved && phoneNeedsReview ? (
                          <Link href={`/admin/ai-sales/edit/${p.id}`} className="font-semibold text-amber-700 hover:underline">Review phone/contact →</Link>
                        ) : approved ? (
                          <Link href={`/admin/ai-sales/edit/${p.id}`} className="font-semibold text-gray-500 hover:underline">Add business email/contact →</Link>
                        ) : (
                          <span className="text-gray-400">Approve before outreach</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!visible.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">No prospects match these review filters.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
