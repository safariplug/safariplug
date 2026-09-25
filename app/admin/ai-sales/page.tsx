import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SupplierScoutForm } from "./supplier-scout-form";
import { startOutreachForAllApproved } from "./bulk-outreach";

type SearchParams = {
  stage?: string;
  city?: string;
  category?: string;
  contact?: string;
  sort?: string;
  outreach?: string;
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

  const [
    { count: total },
    { count: pending },
    { count: partners },
    { count: invites },
    { count: signupStarted },
    invitationLinks,
    prospectQuery,
  ] = await Promise.all([
    supabaseAdmin.from("ai_sales_prospects").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("ai_sales_prospects").select("*", { count: "exact", head: true }).eq("review_status", "pending_review"),
    supabaseAdmin.from("safari_partners").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("partner_invitations").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("partner_invitations").select("*", { count: "exact", head: true }).in("status", ["signup_started", "onboarding"]),
    supabaseAdmin.from("partner_invitations").select("prospect_id").not("prospect_id", "is", null).limit(500),
    supabaseAdmin
      .from("ai_sales_prospects")
      .select("id,business_name,category,city,opportunity_score,status,review_status,contact_email,phone,website,instagram,facebook,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const allProspects = (prospectQuery.data || []) as Prospect[];
  const invitedProspectIds = new Set((invitationLinks.data || []).map((row) => row.prospect_id).filter(Boolean) as string[]);
  const cities = [...new Set(allProspects.map((p) => p.city).filter((value): value is string => Boolean(value)))].sort();
  const categories = [...new Set(allProspects.map((p) => p.category).filter((value): value is string => Boolean(value)))].sort();

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
  const reviewReady = allProspects.filter((p) => p.review_status === "pending_review" && Boolean(p.contact_email)).length;
  const approvedUninvited = allProspects.filter((p) => p.review_status === "approved" && p.status !== "rejected" && !invitedProspectIds.has(p.id));
  const outreachReady = approvedUninvited.filter((p) => Boolean(p.contact_email)).length;
  const contactReviewNeeded = approvedUninvited.filter((p) => !p.contact_email).length;

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
                return (
                  <div key={p.id} className="rounded-xl border p-5">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
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
