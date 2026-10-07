"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supplierActivationSla } from "@/lib/suppliers/activation-sla";

type Offering = { id: string; name: string; price: number; currency: string; status: string; duration_minutes: number };
type Staff = { id: string; display_name: string | null; personal_photo_url: string | null; status: string };
type Profile = { status: string; booking_status: string; service_categories?: { name: string } | null; service_offerings?: Offering[]; service_staff?: Staff[] };
type Business = { id: string; name: string; email: string | null; phone: string | null; status: string; description?: string | null; logo_url?: string | null; cover_image_url?: string | null; service_profiles?: Profile[] };
type SupplierReadiness = {
  ready: boolean;
  issues: { key: string; label: string; href: string; owner?: "supplier" | "platform" }[];
  checks: Record<string, boolean>;
};
type Supplier = {
  id: string;
  contact_name: string;
  invitation_status: string;
  onboarding_status: string;
  completion_percent: number;
  submitted_at: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  review_items?: string[] | null;
  review_note?: string | null;
  review_requested_at?: string | null;
  businesses?: Business | Business[] | null;
  activation_readiness?: SupplierReadiness | null;
};
type Filter = "attention" | "ready" | "platform" | "supplier" | "staff" | "active" | "all";

const REVIEW_OPTIONS = [
  ["business_details", "Business details"],
  ["business_images", "Business images"],
  ["services_pricing", "Services & pricing"],
  ["team", "Team information"],
  ["personal_photos", "Personal photos"],
  ["availability", "Availability"],
  ["staff_verification", "Specialist SafariPlug review"],
  ["verification", "Provider verification"],
  ["payout_details", "Payout details"],
  ["other", "Other"],
] as const;

function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }
function stageLabel(status: string) { return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function readinessBreakdown(supplier: Supplier) {
  const issues = supplier.activation_readiness?.issues ?? [];
  return {
    supplier: issues.filter((item) => item.owner !== "platform"),
    platform: issues.filter((item) => item.owner === "platform"),
  };
}

function activationScore(supplier: Supplier) {
  const checks = Object.values(supplier.activation_readiness?.checks || {});
  if (!checks.length) return { passed: 0, total: 0, percent: supplier.completion_percent || 0 };
  const passed = checks.filter(Boolean).length;
  return { passed, total: checks.length, percent: Math.round((passed / checks.length) * 100) };
}

function guidance(supplier: Supplier) {
  const status = supplier.onboarding_status;
  const readiness = supplier.activation_readiness;
  const blockers = readinessBreakdown(supplier);

  if (supplier.review_requested_at && ["draft", "onboarding", "in_progress"].includes(status)) {
    return { owner: "staff", title: "Early profile review requested", detail: "Supplier can keep completing activation setup while staff checks the business profile.", priority: 0 };
  }

  if (status === "submitted") {
    if (readiness?.ready) {
      return { owner: "staff", title: "Ready for approval", detail: "All activation checks passed. A human can review and approve this supplier now.", priority: 0 };
    }
    if (blockers.supplier.length === 0 && blockers.platform.length > 0) {
      return { owner: "staff", title: "Clear SafariPlug blockers", detail: `${blockers.platform.length} platform-owned activation item${blockers.platform.length === 1 ? "" : "s"} remain before approval.`, priority: 0 };
    }
    if (blockers.supplier.length > 0) {
      return { owner: "staff", title: "Return incomplete submission", detail: `${blockers.supplier.length} supplier-owned item${blockers.supplier.length === 1 ? "" : "s"} still need correction${blockers.platform.length ? `; ${blockers.platform.length} SafariPlug item${blockers.platform.length === 1 ? "" : "s"} also remain` : ""}.`, priority: 0 };
    }
    return { owner: "staff", title: "Review submission", detail: "Supplier is waiting for a human activation decision.", priority: 0 };
  }

  if (status === "changes_requested") {
    const count = Array.isArray(supplier.review_items) ? supplier.review_items.length : 0;
    return { owner: "supplier", title: "Waiting for changes", detail: count ? `${count} requested fix${count === 1 ? "" : "es"} sent to supplier.` : "Supplier must update and resubmit.", priority: 1 };
  }

  if (["approved", "live"].includes(status)) return { owner: "active", title: "Active supplier", detail: "Onboarding is complete. Manage verification and quality.", priority: 4 };
  if (status === "rejected") return { owner: "closed", title: "Closed", detail: "No onboarding action is required.", priority: 5 };

  if (readiness && !readiness.ready) {
    if (blockers.supplier.length === 0 && blockers.platform.length > 0) {
      return {
        owner: "staff",
        title: "SafariPlug action required",
        detail: `${blockers.platform.length} platform-owned activation item${blockers.platform.length === 1 ? "" : "s"} are holding this supplier back. Do not chase the supplier.`,
        priority: 1,
      };
    }
    const firstIssue = blockers.supplier[0] || readiness.issues[0];
    return {
      owner: "supplier",
      title: firstIssue?.label || "Finish activation requirements",
      detail: `${blockers.supplier.length || readiness.issues.length} supplier activation requirement${(blockers.supplier.length || readiness.issues.length) === 1 ? "" : "s"} remaining${blockers.platform.length ? `; ${blockers.platform.length} SafariPlug item${blockers.platform.length === 1 ? "" : "s"} are tracked separately` : ""}.`,
      priority: 2,
    };
  }

  if (readiness?.ready) return { owner: "supplier", title: "Submit for review", detail: "Activation requirements are complete. Supplier can submit for staff review.", priority: 2 };
  return { owner: "supplier", title: "Open Partner 360", detail: "Readiness could not be fully evaluated. Review the supplier record before taking action.", priority: 2 };
}

export default function SuppliersAdminPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("attention");
  const [feedbackSupplier, setFeedbackSupplier] = useState<Supplier | null>(null);
  const [reviewItems, setReviewItems] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState("");

  async function loadReviews() {
    const response = await fetch("/api/admin/suppliers/review", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
    else setMessage(data?.error || "Unable to load supplier pipeline.");
  }

  useEffect(() => { void loadReviews(); }, []);

  const counts = useMemo(() => ({
    total: suppliers.length,
    ready: suppliers.filter((s) => s.onboarding_status === "submitted" && s.activation_readiness?.ready).length,
    platform: suppliers.filter((s) => {
      const blockers = readinessBreakdown(s);
      return blockers.platform.length > 0 && blockers.supplier.length === 0 && !["approved", "live", "rejected"].includes(s.onboarding_status);
    }).length,
    supplier: suppliers.filter((s) => guidance(s).owner === "supplier").length,
    staff: suppliers.filter((s) => guidance(s).owner === "staff").length,
    active: suppliers.filter((s) => guidance(s).owner === "active").length,
    overdue: suppliers.filter((s) => {
      const blockers=readinessBreakdown(s);
      return supplierActivationSla({
        onboardingStatus:s.onboarding_status,
        submittedAt:s.submitted_at,
        reviewRequestedAt:s.review_requested_at,
        updatedAt:s.updated_at,
        hasPlatformOnlyBlockers:blockers.platform.length>0&&blockers.supplier.length===0,
        earlyReviewWaiting:Boolean(s.review_requested_at&&["draft","onboarding","in_progress"].includes(s.onboarding_status)),
      }).key==="overdue";
    }).length,
  }), [suppliers]);

  const visible = useMemo(() => suppliers
    .filter((supplier) => {
      const g = guidance(supplier);
      if (filter === "ready" && !(supplier.onboarding_status === "submitted" && supplier.activation_readiness?.ready)) return false;
      if (filter === "platform") {
        const blockers = readinessBreakdown(supplier);
        if (!(blockers.platform.length > 0 && blockers.supplier.length === 0 && !["approved", "live", "rejected"].includes(supplier.onboarding_status))) return false;
      }
      if (filter === "staff" && g.owner !== "staff") return false;
      if (filter === "supplier" && g.owner !== "supplier") return false;
      if (filter === "active" && g.owner !== "active") return false;
      if (filter === "attention" && !["staff", "supplier"].includes(g.owner)) return false;
      const business = first(supplier.businesses);
      const haystack = `${business?.name || ""} ${supplier.contact_name || ""} ${business?.email || ""} ${business?.phone || ""}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => guidance(a).priority - guidance(b).priority || activationScore(b).percent - activationScore(a).percent || (b.completion_percent || 0) - (a.completion_percent || 0)), [suppliers, filter, query]);

  async function review(supplierId: string, action: "approve" | "reject" | "profile_reviewed", extra?: Record<string, unknown>) {
    setReviewing(supplierId); setMessage("");
    const response = await fetch("/api/admin/suppliers/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplierId, action, ...(extra || {}) }) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? (action === "approve" ? "Supplier approved and published." : action === "profile_reviewed" ? "Early supplier profile review marked complete." : "Supplier rejected.") : data?.error || "Unable to update supplier.");
    setReviewing("");
    if (response.ok) await loadReviews();
  }

  function openFeedback(supplier: Supplier) {
    setFeedbackSupplier(supplier);
    setReviewItems(Array.isArray(supplier.review_items) ? supplier.review_items : []);
    setReviewNote(supplier.review_note || "");
    setMessage("");
  }

  function toggleReviewItem(item: string) {
    setReviewItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  async function requestChanges() {
    if (!feedbackSupplier) return;
    setReviewing(feedbackSupplier.id); setMessage("");
    const response = await fetch("/api/admin/suppliers/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplierId: feedbackSupplier.id, action: "request_changes", reviewItems, reviewNote }),
    });
    const data = await response.json().catch(() => null);
    setReviewing("");
    if (!response.ok) return setMessage(data?.error || "Unable to request changes.");
    setMessage("Requested changes sent to the supplier.");
    setFeedbackSupplier(null);
    setReviewItems([]);
    setReviewNote("");
    await loadReviews();
  }

  return <main className="mx-auto max-w-7xl px-6 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Admin · Partner CRM</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">Supplier onboarding</h1><p className="mt-2 max-w-2xl text-black/55">Start with the suppliers who need attention. Everything else can stay out of the way.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/suppliers/invite" className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">+ Invite supplier manually</Link><button onClick={() => void loadReviews()} className="rounded-full border border-black/15 px-4 py-2 text-sm">Refresh</button></div></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Metric label="Ready to approve" value={counts.ready} active={filter === "ready"} onClick={() => setFilter("ready")} />
      <Metric label="SafariPlug blockers" value={counts.platform} active={filter === "platform"} onClick={() => setFilter("platform")} />
      <Metric label="Waiting on supplier" value={counts.supplier} active={filter === "supplier"} onClick={() => setFilter("supplier")} />
      <Metric label="SLA overdue" value={counts.overdue} />
      <Metric label="Approved / live" value={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
      <Metric label="All suppliers" value={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, contact, email or phone" className="w-full rounded-xl border border-black/15 px-3 py-2.5 lg:max-w-md" />
        <div className="flex flex-wrap gap-2">{([["attention","Needs attention"],["ready","Ready to approve"],["platform","SafariPlug blockers"],["staff","All staff action"],["supplier","Supplier action"],["active","Active"],["all","All"]] as [Filter,string][]).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-sm ${filter === value ? "bg-black text-white" : "bg-black/[.04] text-black/65"}`}>{label}</button>)}</div>
      </div>
    </section>

    {message && <p className="mt-5 rounded-xl bg-black/[.04] px-4 py-3 text-sm">{message}</p>}

    <section className="mt-6">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-black/40">Current view</p><h2 className="mt-1 text-xl font-semibold">{visible.length} supplier{visible.length === 1 ? "" : "s"}</h2></div></div>
      <div className="mt-4 space-y-3">
        {!visible.length && <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/55">No suppliers match this view.</div>}
        {visible.map((supplier) => {
          const business = first(supplier.businesses);
          const profile = first(business?.service_profiles);
          const g = guidance(supplier);
          const category = profile?.service_categories?.name || "Supplier";
          const blockers=readinessBreakdown(supplier);
          const sla=supplierActivationSla({
            onboardingStatus:supplier.onboarding_status,
            submittedAt:supplier.submitted_at,
            reviewRequestedAt:supplier.review_requested_at,
            updatedAt:supplier.updated_at,
            hasPlatformOnlyBlockers:blockers.platform.length>0&&blockers.supplier.length===0,
            earlyReviewWaiting:Boolean(supplier.review_requested_at&&["draft","onboarding","in_progress"].includes(supplier.onboarding_status)),
          });
          return <article key={supplier.id} className="rounded-2xl border border-black/10 p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.75fr_1.25fr_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{business?.name || "Unnamed business"}</h3><span className="rounded-full bg-black/[.05] px-2.5 py-1 text-[11px]">{stageLabel(supplier.onboarding_status)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${sla.key==="overdue"?"bg-red-50 text-red-700":sla.key==="due_soon"?"bg-amber-50 text-amber-700":sla.owner==="staff"?"bg-blue-50 text-blue-700":"bg-black/[.04] text-black/45"}`}>{sla.label}</span></div><p className="mt-1 text-sm text-black/50">{category} · {supplier.contact_name || "No contact name"}</p><p className="mt-1 text-xs text-black/40">{business?.email || business?.phone || "No business contact channel"}</p>{sla.owner==="staff"&&sla.ageHours!==null?<p className="mt-1 text-[11px] text-black/35">{Math.floor(sla.ageHours)}h in staff queue · target {sla.targetHours}h{sla.overdueHours>0?` · ${Math.floor(sla.overdueHours)}h overdue`:""}</p>:null}</div>
              <div>{(() => { const score = activationScore(supplier); return <><p className="text-xs text-black/40">Activation readiness</p><div className="mt-1 flex items-center gap-3"><strong className="text-xl">{score.percent}%</strong><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black" style={{ width: `${Math.min(100, Math.max(0, score.percent))}%` }} /></div></div>{score.total ? <p className="mt-1 text-[11px] text-black/40">{score.passed}/{score.total} checks passed · profile {supplier.completion_percent}%</p> : <p className="mt-1 text-[11px] text-black/40">Profile {supplier.completion_percent}%</p>}</>; })()}</div>
              <div className={`rounded-xl p-4 ${g.owner === "staff" ? "bg-amber-50 ring-1 ring-amber-200" : g.owner === "active" ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-black/[.025] ring-1 ring-black/5"}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-black/40">Next · {g.owner === "staff" ? "SafariPlug staff" : g.owner === "supplier" ? "Supplier" : stageLabel(g.owner)}</p><h4 className="mt-1 font-semibold">{g.title}</h4><p className="mt-1 text-sm text-black/50">{g.detail}</p>{supplier.onboarding_status === "submitted" && supplier.activation_readiness?.issues?.length ? <div className="mt-3 space-y-1">{supplier.activation_readiness.issues.slice(0,4).map((item) => <p key={item.key} className="text-xs text-amber-900/75">• {item.label}</p>)}{supplier.activation_readiness.issues.length > 4 && <p className="text-xs text-amber-900/60">+ {supplier.activation_readiness.issues.length - 4} more in Partner 360</p>}</div> : null}{supplier.onboarding_status === "changes_requested" && supplier.review_note && <p className="mt-2 line-clamp-2 text-xs text-black/45">Note: {supplier.review_note}</p>}</div>
              <div className="flex flex-col gap-2"><Link href={`/admin/ai-sales/partners/${supplier.id}`} className="rounded-full bg-black px-4 py-2 text-center text-sm text-white">Open Partner 360</Link>{supplier.review_requested_at && ["draft","onboarding","in_progress"].includes(supplier.onboarding_status) && <><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "profile_reviewed")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Mark profile reviewed</button><button disabled={reviewing === supplier.id} onClick={() => openFeedback(supplier)} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Request changes</button></>}{supplier.onboarding_status === "submitted" && <><button title={supplier.activation_readiness?.ready ? "Approve supplier" : "Complete activation requirements first"} disabled={reviewing === supplier.id || !supplier.activation_readiness?.ready} onClick={() => void review(supplier.id, "approve")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">Approve</button><button disabled={reviewing === supplier.id} onClick={() => openFeedback(supplier)} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Request changes</button></>}{supplier.onboarding_status === "changes_requested" && <button onClick={() => openFeedback(supplier)} className="rounded-full border border-black/15 px-4 py-2 text-sm">View requested fixes</button>}</div>
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/60 p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-800/60">Activation service level</p><h2 className="mt-1 text-xl font-semibold">Internal 24-hour staff target</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-black/60">Submitted suppliers, platform-only blockers and early profile-review requests should receive SafariPlug staff action within 24 hours. This is an internal operating target, not a supplier-facing guarantee. Changes requested from suppliers remain supplier-owned, with a 72-hour follow-up target.</p></section><section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-800/60">Governed recruitment</p>
      <h2 className="mt-1 text-xl font-semibold">New suppliers start in CRM</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-black/60">Create or review the organization in Organization 360, confirm a real contact, then draft and approve outreach. This keeps the prospect, invitation, supplier account and Partner 360 relationship connected from the first contact through activation.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/suppliers/invite" className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">Invite a known supplier →</Link><Link href="/admin/ai-sales" className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold">Choose or review a prospect</Link>
        <Link href="/admin/ai-sales/invitations" className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold">Open governed outreach</Link>
      </div>
    </section>

    {feedbackSupplier && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Request changes</p><h2 className="mt-1 text-2xl font-semibold">{first(feedbackSupplier.businesses)?.name || "Supplier"}</h2><p className="mt-2 text-sm text-black/55">Choose exactly what the supplier needs to fix. These items will appear as direct actions in their portal.</p></div><button onClick={() => setFeedbackSupplier(null)} className="rounded-full border border-black/10 px-3 py-1.5 text-sm">Close</button></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{REVIEW_OPTIONS.map(([value,label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${reviewItems.includes(value) ? "border-black bg-black/[.03]" : "border-black/10"}`}><input type="checkbox" checked={reviewItems.includes(value)} onChange={() => toggleReviewItem(value)} /><span>{label}</span></label>)}</div>
        <label className="mt-5 block text-sm"><span className="mb-1 block font-medium">Message to supplier</span><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={5} maxLength={2000} placeholder="Explain only what they need to change. Keep it clear and actionable." className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => setFeedbackSupplier(null)} className="rounded-full border border-black/15 px-4 py-2 text-sm">Cancel</button><button disabled={reviewing === feedbackSupplier.id || (!reviewItems.length && !reviewNote.trim())} onClick={() => void requestChanges()} className="rounded-full bg-black px-5 py-2 text-sm text-white disabled:opacity-40">{reviewing === feedbackSupplier.id ? "Sending…" : "Send requested changes"}</button></div>
      </div>
    </div>}
  </main>;
}

function Metric({ label, value, active, onClick }: { label: string; value: number; active?: boolean; onClick?: () => void }) { return <button onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-black bg-black text-white" : "border-black/10 hover:bg-black/[.025]"}`}><p className={`text-xs ${active ? "text-white/65" : "text-black/45"}`}>{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></button>; }
