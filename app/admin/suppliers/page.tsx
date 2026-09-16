"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string; slug: string };
type Offering = { id: string; name: string; price: number; currency: string; status: string; duration_minutes: number };
type Staff = { id: string; display_name: string | null; personal_photo_url: string | null; status: string };
type Profile = { status: string; booking_status: string; service_categories?: { name: string } | null; service_offerings?: Offering[]; service_staff?: Staff[] };
type Business = { id: string; name: string; email: string | null; phone: string | null; status: string; description?: string | null; logo_url?: string | null; cover_image_url?: string | null; service_profiles?: Profile[] };
type Supplier = {
  id: string;
  contact_name: string;
  invitation_status: string;
  onboarding_status: string;
  completion_percent: number;
  submitted_at: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  review_items?: string[] | null;
  review_note?: string | null;
  review_requested_at?: string | null;
  businesses?: Business | Business[] | null;
};
type SupplierForm = { businessName: string; contactName: string; email: string; phone: string; categorySlug: string; cityId: string; notes: string };
type Filter = "attention" | "supplier" | "staff" | "active" | "all";

const REVIEW_OPTIONS = [
  ["business_details", "Business details"],
  ["business_images", "Business images"],
  ["services_pricing", "Services & pricing"],
  ["team", "Team information"],
  ["personal_photos", "Personal photos"],
  ["availability", "Availability"],
  ["verification", "Verification"],
  ["payout_details", "Payout details"],
  ["other", "Other"],
] as const;

const emptyForm: SupplierForm = { businessName: "", contactName: "", email: "", phone: "", categorySlug: "", cityId: "", notes: "" };
function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }
function stageLabel(status: string) { return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function guidance(supplier: Supplier) {
  const business = first(supplier.businesses);
  const profile = first(business?.service_profiles);
  const offerings = profile?.service_offerings ?? [];
  const staff = profile?.service_staff ?? [];
  const status = supplier.onboarding_status;
  const basics = Boolean(business?.name && business?.description && (business?.email || business?.phone));
  const images = Boolean(business?.logo_url || business?.cover_image_url);
  const staffPhotos = staff.length > 0 && staff.every((member) => Boolean(member.personal_photo_url));

  if (status === "submitted") return { owner: "staff", title: "Review submission", detail: "Supplier is waiting for a human decision.", priority: 0 };
  if (status === "changes_requested") {
    const count = Array.isArray(supplier.review_items) ? supplier.review_items.length : 0;
    return { owner: "supplier", title: "Waiting for changes", detail: count ? `${count} requested fix${count === 1 ? "" : "es"} sent to supplier.` : "Supplier must update and resubmit.", priority: 1 };
  }
  if (["approved", "live"].includes(status)) return { owner: "active", title: "Active supplier", detail: "Onboarding is complete. Manage verification and quality.", priority: 4 };
  if (status === "rejected") return { owner: "closed", title: "Closed", detail: "No onboarding action is required.", priority: 5 };
  if (!basics) return { owner: "supplier", title: "Complete business details", detail: "Description and a working business contact are still needed.", priority: 2 };
  if (!images) return { owner: "supplier", title: "Add business images", detail: "Logo or cover image is still missing.", priority: 2 };
  if (profile && !offerings.length) return { owner: "supplier", title: "Add services and pricing", detail: "No service offering has been added yet.", priority: 2 };
  if (profile && !staff.length) return { owner: "supplier", title: "Add team", detail: "At least one service provider is still needed.", priority: 2 };
  if (profile && !staffPhotos) return { owner: "supplier", title: "Add personal photos", detail: "One or more providers are missing a personal photo.", priority: 2 };
  if (supplier.completion_percent < 80) return { owner: "supplier", title: "Finish onboarding", detail: `Profile is ${supplier.completion_percent}% complete.`, priority: 2 };
  return { owner: "supplier", title: "Submit for review", detail: "Profile appears ready but has not been submitted.", priority: 2 };
}

export default function SuppliersAdminPage() {
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
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

  useEffect(() => { void (async () => {
    const response = await fetch("/api/admin/supplier-categories", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      const loaded = Array.isArray(data?.categories) ? data.categories : [];
      setCategories(loaded);
      if (loaded.length) setForm((current) => ({ ...current, categorySlug: current.categorySlug || loaded[0].slug }));
    } else setMessage(data?.error || "Unable to load supplier categories.");
    setLoadingCategories(false);
    await loadReviews();
  })(); }, []);

  const counts = useMemo(() => ({
    total: suppliers.length,
    supplier: suppliers.filter((s) => guidance(s).owner === "supplier").length,
    staff: suppliers.filter((s) => guidance(s).owner === "staff").length,
    active: suppliers.filter((s) => guidance(s).owner === "active").length,
  }), [suppliers]);

  const visible = useMemo(() => suppliers
    .filter((supplier) => {
      const g = guidance(supplier);
      if (filter === "staff" && g.owner !== "staff") return false;
      if (filter === "supplier" && g.owner !== "supplier") return false;
      if (filter === "active" && g.owner !== "active") return false;
      if (filter === "attention" && !["staff", "supplier"].includes(g.owner)) return false;
      const business = first(supplier.businesses);
      const haystack = `${business?.name || ""} ${supplier.contact_name || ""} ${business?.email || ""} ${business?.phone || ""}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => guidance(a).priority - guidance(b).priority || (b.completion_percent || 0) - (a.completion_percent || 0)), [suppliers, filter, query]);

  const set = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function invite() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/suppliers/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Supplier created and invitation email sent." : data?.error || "Unable to create supplier.");
    setSaving(false);
    if (response.ok) { setForm((current) => ({ ...emptyForm, categorySlug: current.categorySlug })); await loadReviews(); }
  }

  async function review(supplierId: string, action: "approve" | "reject", extra?: Record<string, unknown>) {
    setReviewing(supplierId); setMessage("");
    const response = await fetch("/api/admin/suppliers/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplierId, action, ...(extra || {}) }) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? (action === "approve" ? "Supplier approved and published." : "Supplier rejected.") : data?.error || "Unable to update supplier.");
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
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Admin · Partner CRM</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">Supplier onboarding</h1><p className="mt-2 max-w-2xl text-black/55">Start with the suppliers who need attention. Everything else can stay out of the way.</p></div><button onClick={() => void loadReviews()} className="rounded-full border border-black/15 px-4 py-2 text-sm">Refresh</button></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Needs staff review" value={counts.staff} active={filter === "staff"} onClick={() => setFilter("staff")} />
      <Metric label="Waiting on supplier" value={counts.supplier} active={filter === "supplier"} onClick={() => setFilter("supplier")} />
      <Metric label="Approved / live" value={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
      <Metric label="All suppliers" value={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, contact, email or phone" className="w-full rounded-xl border border-black/15 px-3 py-2.5 lg:max-w-md" />
        <div className="flex flex-wrap gap-2">{([["attention","Needs attention"],["staff","Staff action"],["supplier","Supplier action"],["active","Active"],["all","All"]] as [Filter,string][]).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-sm ${filter === value ? "bg-black text-white" : "bg-black/[.04] text-black/65"}`}>{label}</button>)}</div>
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
          return <article key={supplier.id} className="rounded-2xl border border-black/10 p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.75fr_1.25fr_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{business?.name || "Unnamed business"}</h3><span className="rounded-full bg-black/[.05] px-2.5 py-1 text-[11px]">{stageLabel(supplier.onboarding_status)}</span></div><p className="mt-1 text-sm text-black/50">{category} · {supplier.contact_name || "No contact name"}</p><p className="mt-1 text-xs text-black/40">{business?.email || business?.phone || "No business contact channel"}</p></div>
              <div><p className="text-xs text-black/40">Progress</p><div className="mt-1 flex items-center gap-3"><strong className="text-xl">{supplier.completion_percent}%</strong><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black" style={{ width: `${Math.min(100, Math.max(0, supplier.completion_percent || 0))}%` }} /></div></div></div>
              <div className={`rounded-xl p-4 ${g.owner === "staff" ? "bg-amber-50 ring-1 ring-amber-200" : g.owner === "active" ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-black/[.025] ring-1 ring-black/5"}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-black/40">Next · {g.owner === "staff" ? "SafariPlug staff" : g.owner === "supplier" ? "Supplier" : stageLabel(g.owner)}</p><h4 className="mt-1 font-semibold">{g.title}</h4><p className="mt-1 text-sm text-black/50">{g.detail}</p>{supplier.onboarding_status === "changes_requested" && supplier.review_note && <p className="mt-2 line-clamp-2 text-xs text-black/45">Note: {supplier.review_note}</p>}</div>
              <div className="flex flex-col gap-2"><Link href={`/admin/ai-sales/partners/${supplier.id}`} className="rounded-full bg-black px-4 py-2 text-center text-sm text-white">Open Partner 360</Link>{supplier.onboarding_status === "submitted" && <><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "approve")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Approve</button><button disabled={reviewing === supplier.id} onClick={() => openFeedback(supplier)} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Request changes</button></>}{supplier.onboarding_status === "changes_requested" && <button onClick={() => openFeedback(supplier)} className="rounded-full border border-black/15 px-4 py-2 text-sm">View requested fixes</button>}</div>
            </div>
          </article>;
        })}
      </div>
    </section>

    <details className="mt-8 rounded-2xl border border-black/10 p-5"><summary className="cursor-pointer font-semibold">Invite a new supplier</summary><section className="mt-5 grid gap-4 md:grid-cols-2">{[["businessName","Business name"],["contactName","Contact person"],["email","Email"],["phone","Phone"],["cityId","City ID (optional)"]].map(([key,label]) => <label key={key} className="text-sm"><span className="mb-1 block font-medium">{label}</span><input value={form[key as keyof SupplierForm]} onChange={(event) => set(key as keyof SupplierForm, event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>)}<label className="text-sm"><span className="mb-1 block font-medium">Supplier category</span><select value={form.categorySlug} disabled={loadingCategories || !categories.length} onChange={(event) => set("categorySlug", event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5 disabled:opacity-50">{!categories.length && <option value="">{loadingCategories ? "Loading categories…" : "No active categories"}</option>}{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></label><label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Internal notes</span><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><div className="md:col-span-2"><button onClick={invite} disabled={saving || loadingCategories || !form.categorySlug} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-50">{saving ? "Creating…" : "Create & invite supplier"}</button></div></section></details>

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
