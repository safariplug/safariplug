"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string; slug: string };
type Supplier = {
  id: string; contact_name: string; onboarding_status: string; completion_percent: number; submitted_at: string | null;
  businesses?: { name: string; email: string | null; phone: string | null; status: string } | null;
  service_profiles?: { status: string; booking_status: string; service_categories?: { name: string } | null; service_offerings?: { id: string; name: string; price: number; currency: string; status: string; duration_minutes: number }[] } | null;
};
type SupplierForm = { businessName: string; contactName: string; email: string; phone: string; categorySlug: string; cityId: string; notes: string };
const emptyForm: SupplierForm = { businessName: "", contactName: "", email: "", phone: "", categorySlug: "", cityId: "", notes: "" };

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

  const pending = suppliers.filter((supplier) => supplier.onboarding_status === "submitted" || supplier.onboarding_status === "changes_requested");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-sm uppercase tracking-[.2em] text-black/40">Admin · Partner CRM</p>
      <h1 className="mt-2 text-4xl font-semibold">Supplier management</h1>
      <p className="mt-3 max-w-3xl text-black/60">Invite providers, review completed onboarding, and publish approved service businesses into the customer marketplace.</p>

      <section className="mt-8 grid gap-5 rounded-2xl border border-black/10 p-6 md:grid-cols-2">
        {[["businessName", "Business name"], ["contactName", "Contact person"], ["email", "Email"], ["phone", "Phone"], ["cityId", "City ID (optional)"]].map(([key, label]) => (
          <label key={key} className="text-sm"><span className="mb-1 block font-medium">{label}</span><input value={form[key as keyof SupplierForm]} onChange={(event) => set(key as keyof SupplierForm, event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
        ))}
        <label className="text-sm"><span className="mb-1 block font-medium">Supplier category</span><select value={form.categorySlug} disabled={loadingCategories || !categories.length} onChange={(event) => set("categorySlug", event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5 disabled:opacity-50">{!categories.length && <option value="">{loadingCategories ? "Loading categories…" : "No active categories"}</option>}{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Internal notes</span><textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
        <div className="md:col-span-2"><button onClick={invite} disabled={saving || loadingCategories || !form.categorySlug} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-50">{saving ? "Creating…" : "Create & invite supplier"}</button></div>
      </section>

      {message && <p className="mt-4 rounded-xl bg-black/[.04] px-4 py-3 text-sm">{message}</p>}

      <section className="mt-10">
        <div className="flex items-end justify-between"><div><p className="text-sm uppercase tracking-[.18em] text-black/40">Review queue</p><h2 className="mt-1 text-2xl font-semibold">{pending.length} supplier{pending.length === 1 ? "" : "s"} awaiting review</h2></div><button onClick={() => void loadReviews()} className="rounded-full border border-black/15 px-4 py-2 text-sm">Refresh</button></div>
        <div className="mt-5 space-y-4">
          {pending.length === 0 && <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/55">No submitted suppliers are waiting for review.</div>}
          {pending.map((supplier) => {
            const profile = supplier.service_profiles;
            const offerings = profile?.service_offerings ?? [];
            return <article key={supplier.id} className="rounded-2xl border border-black/10 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div><h3 className="text-xl font-semibold">{supplier.businesses?.name || "Unnamed business"}</h3><p className="mt-1 text-sm text-black/55">{profile?.service_categories?.name || "Service provider"} · {supplier.contact_name}</p><p className="mt-2 text-sm">Profile completion: <strong>{supplier.completion_percent}%</strong> · {offerings.length} service{offerings.length === 1 ? "" : "s"}</p>{offerings.length > 0 && <p className="mt-2 text-sm text-black/60">{offerings.map((item) => `${item.name} (${item.currency} ${item.price})`).join(" · ")}</p>}</div>
                <div className="flex flex-wrap gap-2"><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "approve")} className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50">Approve & publish</button><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "request_changes")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Request changes</button><button disabled={reviewing === supplier.id} onClick={() => void review(supplier.id, "reject")} className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50">Reject</button></div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="mt-10 rounded-2xl bg-black/[.04] p-6"><h2 className="font-semibold">Supplier flow</h2><ol className="mt-3 space-y-2 text-sm text-black/65"><li>1. SafariPlug creates the supplier account and sends a secure invitation.</li><li>2. Supplier completes business details, services, pricing, availability and images.</li><li>3. Supplier submits at 80%+ completion.</li><li>4. Admin reviews and approves; approval activates the business, service profile and draft offerings for the customer marketplace.</li></ol></section>
    </main>
  );
}
