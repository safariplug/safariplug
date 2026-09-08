"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string; slug: string };

type SupplierForm = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  categorySlug: string;
  cityId: string;
  notes: string;
};

const emptyForm: SupplierForm = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  categorySlug: "",
  cityId: "",
  notes: "",
};

export default function SuppliersAdminPage() {
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/supplier-categories", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(data?.error || "Unable to load supplier categories.");
      } else {
        const loaded = Array.isArray(data?.categories) ? data.categories : [];
        setCategories(loaded);
        if (loaded.length) setForm((current) => ({ ...current, categorySlug: current.categorySlug || loaded[0].slug }));
      }
      setLoadingCategories(false);
    })();
  }, []);

  const set = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function invite() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/suppliers/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Supplier created and invitation email sent." : data?.error || "Unable to create supplier.");
    setSaving(false);
    if (response.ok) setForm((current) => ({ ...emptyForm, categorySlug: current.categorySlug }));
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm uppercase tracking-[.2em] text-black/40">Admin · Partner CRM</p>
      <h1 className="mt-2 text-4xl font-semibold">Create supplier account</h1>
      <p className="mt-3 max-w-2xl text-black/60">Create the supplier shell, send a secure invitation, and let the supplier create their own password and finish their profile.</p>

      <section className="mt-8 grid gap-5 rounded-2xl border border-black/10 p-6 md:grid-cols-2">
        {[["businessName", "Business name"], ["contactName", "Contact person"], ["email", "Email"], ["phone", "Phone"], ["cityId", "City ID (optional)"]].map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block font-medium">{label}</span>
            <input value={form[key as keyof SupplierForm]} onChange={(event) => set(key as keyof SupplierForm, event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5" />
          </label>
        ))}

        <label className="text-sm">
          <span className="mb-1 block font-medium">Supplier category</span>
          <select
            value={form.categorySlug}
            disabled={loadingCategories || !categories.length}
            onChange={(event) => set("categorySlug", event.target.value)}
            className="w-full rounded-xl border border-black/15 px-3 py-2.5 disabled:opacity-50"
          >
            {!categories.length && <option value="">{loadingCategories ? "Loading categories…" : "No active categories"}</option>}
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-black/40">Categories are loaded from SafariPlug's active service catalog.</span>
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-medium">Internal notes</span>
          <textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={4} className="w-full rounded-xl border border-black/15 px-3 py-2.5" />
        </label>

        <div className="md:col-span-2">
          <button onClick={invite} disabled={saving || loadingCategories || !form.categorySlug} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create & invite supplier"}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-black/[.04] p-6">
        <h2 className="font-semibold">Supplier flow</h2>
        <ol className="mt-3 space-y-2 text-sm text-black/65">
          <li>1. SafariPlug creates the supplier account and business profile.</li>
          <li>2. Supplier receives an invitation email and creates their password.</li>
          <li>3. Supplier completes business details, services, pricing, availability and images.</li>
          <li>4. Supplier submits for review; SafariPlug approves before the profile goes live.</li>
        </ol>
      </section>
    </main>
  );
}
