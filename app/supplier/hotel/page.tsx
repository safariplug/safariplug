"use client";

import { useEffect, useState } from "react";

type Supplier = { business?: Record<string, any>; account?: Record<string, any> };

export default function SupplierHotelPage() {
  const [supplier, setSupplier] = useState<Supplier>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Please sign in through your supplier invitation first.");
    if (data.business?.business_type !== "Hotel") return setMessage("This workspace is available to hotel suppliers only.");
    setSupplier(data);
  }

  useEffect(() => { void load(); }, []);

  async function save(fields: Record<string, unknown>) {
    setSaving(true); setMessage("");
    const response = await fetch("/api/supplier/onboarding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? `Saved. Profile completion: ${data.completion_percent}%` : data.error || "Unable to save.");
    if (response.ok) void load();
  }

  if (!supplier.business) return <main className="mx-auto max-w-4xl px-6 py-16"><h1 className="text-3xl font-semibold">Hotel supplier workspace</h1><p className="mt-3 text-black/60">{message || "Loading your hotel workspace…"}</p></main>;
  const b = supplier.business;

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <p className="text-sm uppercase tracking-[.2em] text-black/40">Hotel supplier</p>
    <h1 className="mt-2 text-4xl font-semibold">Property & booking readiness</h1>
    <p className="mt-2 max-w-2xl text-black/60">Complete the property profile customers need to trust your hotel. SafariPlug keeps live room inventory and external connectivity separate until a supported provider connection is configured.</p>

    <section className="mt-8 rounded-2xl border border-black/10 bg-black/[.02] p-5">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-black/40">Profile status</p><h2 className="mt-1 text-xl font-semibold">{supplier.account?.completion_percent ?? 0}% complete</h2></div><span className="rounded-full bg-black/[.05] px-3 py-1 text-xs">{supplier.account?.onboarding_status || "draft"}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black" style={{ width: `${supplier.account?.completion_percent ?? 0}%` }} /></div>
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5">
      <h2 className="text-xl font-semibold">Property details</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Hotel name" value={b.name} />
        <Field label="Contact person" value={b.supplier_contact_name} />
        <Field label="Phone" value={b.phone} />
        <Field label="WhatsApp" value={b.whatsapp} />
        <Field label="Email" value={b.email} disabled />
        <Field label="Website" value={b.website_url} />
        <Field label="Address" value={b.address} />
        <Field label="Instagram" value={b.instagram_url} />
      </div>
      <label className="mt-4 block text-sm"><span className="mb-1 block font-medium">Property description</span><textarea id="hotel-description" defaultValue={b.description || ""} rows={5} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={saving} onClick={() => { const el = document.getElementById("hotel-description") as HTMLTextAreaElement | null; void save({ description: el?.value || "" }); }} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-40">Save property profile</button></div>
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5">
      <p className="text-xs uppercase tracking-[.18em] text-black/40">Booking connectivity</p>
      <h2 className="mt-1 text-xl font-semibold">Connect inventory when a supported channel is ready</h2>
      <p className="mt-2 text-sm leading-6 text-black/60">This workspace does not create fake room availability. Your hotel can use SafariPlug's hotel search/booking integrations when configured, while supplier connectivity can be added as a controlled integration layer.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><Status title="Property profile" done={Boolean(b.name && b.description && b.address && b.phone)} /><Status title="Public contact" done={Boolean(b.phone && b.email)} /><Status title="Booking inventory" done={false} /></div>
      <p className="mt-4 text-xs text-black/45">Inventory status is intentionally shown as “not connected” until SafariPlug has a real provider contract or channel connection. No availability is claimed here.</p>
    </section>

    {message && <p className="mt-5 text-sm text-black/60">{message}</p>}
  </main>;
}

function Field({ label, value, disabled }: { label: string; value?: string | null; disabled?: boolean }) {
  return <label className="text-sm"><span className="mb-1 block font-medium">{label}</span><input disabled={disabled} defaultValue={value || ""} className="w-full rounded-xl border border-black/15 px-3 py-2.5 disabled:bg-black/[.03]" /></label>;
}

function Status({ title, done }: { title: string; done: boolean }) {
  return <div className="rounded-xl border border-black/10 p-4"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-black/50">{done ? "Ready" : "Not connected"}</div></div>;
}
