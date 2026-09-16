"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string; slug: string };
type Offering = { id: string; name: string; price: number; currency: string; status: string; duration_minutes: number };
type Staff = { id: string; display_name: string | null; personal_photo_url: string | null; status: string };
type Profile = { status: string; booking_status: string; service_categories?: { name: string } | null; service_offerings?: Offering[]; service_staff?: Staff[] };
type Business = { id: string; name: string; email: string | null; phone: string | null; status: string; description?: string | null; logo_url?: string | null; cover_image_url?: string | null; service_profiles?: Profile[] };
type Supplier = {
  id: string; contact_name: string; invitation_status: string; onboarding_status: string; completion_percent: number; submitted_at: string | null; approved_at?: string | null; created_at?: string | null;
  businesses?: Business | Business[] | null;
};
type SupplierForm = { businessName: string; contactName: string; email: string; phone: string; categorySlug: string; cityId: string; notes: string };
const emptyForm: SupplierForm = { businessName: "", contactName: "", email: "", phone: "", categorySlug: "", cityId: "", notes: "" };

function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }
function stageLabel(status: string) { return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function supplierGuidance(supplier: Supplier) {
  const business = first(supplier.businesses);
  const profile = first(business?.service_profiles);
  const offerings = profile?.service_offerings ?? [];
  const staff = profile?.service_staff ?? [];
  const hasBasics = Boolean(business?.name && (business?.email || business?.phone) && business?.description);
  const hasImages = Boolean(business?.logo_url || business?.cover_image_url);
  const hasOfferings = offerings.length > 0;
  const hasStaff = staff.length > 0;
  const hasStaffPhotos = staff.length > 0 && staff.every((member) => Boolean(member.personal_photo_url));
  const status = supplier.onboarding_status;

  if (status === "submitted") return { owner: "SafariPlug staff", title: "Review supplier submission", detail: "Supplier has submitted onboarding and is waiting for a human decision.", tone: "staff", action: "Review submission" };
  if (status === "changes_requested") return { owner: "Supplier", title: "Waiting for requested changes", detail: "SafariPlug already requested changes. No approval action should be taken until the supplier resubmits.", tone: "supplier", action: "View Partner 360" };
  if (status === "approved" || status === "live") return { owner: "SafariPlug staff", title: "Manage active supplier", detail: "Onboarding is approved. Continue verification, inventory quality and relationship management.", tone: "managed", action: "Open Partner 360" };
  if (status === "rejected") return { owner: "SafariPlug staff", title: "Closed / rejected", detail: "No onboarding action is currently required.", tone: "closed", action: "Open Partner 360" };
  if (!hasBasics) return { owner: "Supplier", title: "Complete business basics", detail: "Business description and a public email or phone are still needed.", tone: "supplier", action: "View onboarding" };
  if (!hasImages) return { owner: "Supplier", title: "Add business images", detail: "A logo or cover image is still missing.", tone: "supplier", action: "View onboarding" };
  if (profile && !hasOfferings) return { owner: "Supplier", title: "Add services and pricing", detail: "No service offering has been added yet.", tone: "supplier", action: "View onboarding" };
  if (profile && !hasStaff) return { owner: "Supplier", title: "Add team / service provider", detail: "At least one provider or team member is still needed.", tone: "supplier", action: "View onboarding" };
  if (profile && !hasStaffPhotos) return { owner: "Supplier", title: "Add personal photos", detail: "One or more service providers are missing their required personal photo.", tone: "supplier", action: "View onboarding" };
  if (supplier.completion_percent < 80) return { owner: "Supplier", title: "Finish remaining onboarding", detail: `Profile is ${supplier.completion_percent}% complete. The supplier should continue the guided onboarding flow.`, tone: "supplier", action: "View onboarding" };
  return { owner: "Supplier", title: "Submit for SafariPlug review", detail: "Profile appears ready for submission but has not yet been submitted.", tone: "supplier", action: "View onboarding" };
}

export default function SuppliersAdminPage() {
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [reviewing, setReviewing] = useState("");

  async function loadReviews() {
    const response = await fetch("/api/admin/suppliers/review", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
    else setMessage(data?.error || "Unable to load supplier pipeline.");
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/supplier-categories", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) setMessage(data?.error || "Unable to load supplier categories.");
      else {
        const loaded = Array.isArray(data?.categories) ? data.categories : [];
        setCategories(loaded);
        if (loaded.length) setForm((current) => ({ ...current, categorySlug: current.categorySlug || loaded[0].slug }));
      }
      setLoadingCategories(false);
      await loadReviews();
    })();
  }, []);

  const counts = useMemo(() => ({
    total: suppliers.length,
    supplierAction: suppliers.filter((s) => supplierGuidance(s).owner === "Supplier" && !["changes_requested"].includes(s.onboarding_status)).length,
    staffAction: suppliers.filter((s) => s.onboarding_status === "submitted").length,
    active: suppliers.filter((s) => ["approved", "live"].includes(s.onboarding_status)).length,
  }), [suppliers]);

  const set = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function invite() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/suppliers/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Supplier created and invitation email sent." : data?.error || "Unable to create supplier.");
    setSaving(false);
    if (response.ok) { setForm((current) => ({ ...emptyForm, categorySlug: current.categorySlug })); await loadReviews(); }
  }
  async function review(supplierId: string, action: "approve" | "request_changes" | "reject") {
    setReviewing(supplierId); setMessage("");
    const response = await fetch("/api/admin/suppliers/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplierId, action }) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? `Supplier ${action === "approve" ? "approved and published" : action === "reject" ? "rejected" : "returned for changes"}.` : data?.error || "Unable to update supplier.");
    setReviewing("");
    if (response.ok) await loadReviews();
  }

  return <main className="mx-auto max-w-7xl px-6 py-10">
    <p className="text-sm uppercase tracking-[.2em] text-black/40">Admin · Partner CRM</p>
    <h1 className="mt-2 text-4xl font-semibold">Supplier onboarding command center</h1>
    <p className="mt-3 max-w-3xl text-black/60">See every supplier's current stage, who needs to act next, what is missing, and the one next action your team should take.</p>

    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="All suppliers" value={counts.total} />
      <Metric label="Waiting on supplier" value={counts.supplierAction} />
      <Metric label="Needs staff review" value={counts.staffAction} />
      <Metric label="Approved / live" value={counts.active} />
    </section>

    {message && <p className="mt-5 rounded-xl bg-black/[.04] px-4 py-3 text-sm">{message}</p>}

    <section className="mt-8">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm uppercase tracking-[.18em] text-black/40">Guided pipeline</p><h2 className="mt-1 text-2xl font-semibold">Who needs to do what next</h2></div><button onClick={() => void loadReviews()} className="rounded-full border border-black/15 px-4 py-2 text-sm">Refresh</button></div>
      <div className="mt-5 space-y-4">
        {!suppliers.length && <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/55">No supplier onboarding records yet.</div>}
        {suppliers.map((supplier) => {
          const business = first(supplier.businesses);
          const profile = first(business?.service_profiles);
          const category = profile?.service_categories?.name || "Supplier";
          const guidance = supplierGuidance(supplier);
          const offerings = profile?.service_offerings ?? [];
          return <article key={supplier.id} className="rounded-2xl border border-black/10 p-5">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_.8fr_1.4fr_auto] lg:items-start">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{business?.name || "Unnamed business"}</h3><span className="rounded-full bg-black/[.05] px-2.5 py-1 text-[11px] font-medium">{stageLabel(supplier.onboarding_status)}</span></div><p className="mt-1 text-sm text-black/55">{category} · {supplier.contact_name || "No contact name"}</p><p className="mt-2 text-xs text-black/45">{business?.email || business?.phone || "No business contact channel"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-black/40">Progress</p><p className="mt-1 text-2xl font-semibold">{supplier.completion_percent}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black" style={{ width: `${Math.min(100, Math.max(0, supplier.completion_percent || 0))}%` }} /></div><p className="mt-2 text-xs text-black/45">{offerings.length} service{offerings.length === 1 ? "" : "s"}</p></div>
              <div className={`rounded-xl border p-4 ${guidance.tone === "staff" ? "border-amber-300 bg-amber-50" : guidance.tone === "managed" ? "border-emerald-200 bg-emerald-50" : "border-black/10 bg-black/[.02]"}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Next owner · {guidance.owner}</p><h4 className="mt-1 font-semibold">{guidance.title}</h4><p className="mt-1 text-sm leading-5 text-black/55">{guidance.detail}</p></div>
              <div className="flex flex-col gap-2">
                <Link href={`/admin/ai-sales/partners/${supplier.id}`} className="rounded-full bg-black px-4 py-2 text-center text-sm text-white">Open Partner 360</Link>
                {supplier.onboarding_status === "submitted" && <><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "approve")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Approve & publish</button><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "request_changes")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Request changes</button></>}
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>

    <details className="mt-10 rounded-2xl border border-black/10 p-5"><summary className="cursor-pointer font-semibold">Invite a new supplier</summary><section className="mt-5 grid gap-5 md:grid-cols-2">
      {[["businessName", "Business name"], ["contactName", "Contact person"], ["email", "Email"], ["phone", "Phone"], ["cityId", "City ID (optional)"]].map(([key, label]) => <label key={key} className="text-sm"><span className="mb-1 block font-medium">{label}</span><input value={form[key as keyof SupplierForm]} onChange={(event) => set(key as keyof SupplierForm, event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>)}
      <label className="text-sm"><span className="mb-1 block font-medium">Supplier category</span><select value={form.categorySlug} disabled={loadingCategories || !categories.length} onChange={(event) => set("categorySlug", event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5 disabled:opacity-50">{!categories.length && <option value="">{loadingCategories ? "Loading categories…" : "No active categories"}</option>}{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></label>
      <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Internal notes</span><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
      <div className="md:col-span-2"><button onClick={invite} disabled={saving || loadingCategories || !form.categorySlug} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-50">{saving ? "Creating…" : "Create & invite supplier"}</button></div>
    </section></details>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>; }
