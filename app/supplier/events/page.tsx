"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Supplier = { business?: Record<string, any>; account?: Record<string, any> };

export default function SupplierEventsPage() {
  const [supplier, setSupplier] = useState<Supplier>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "Please sign in through your supplier invitation first.");
      if (data.business?.business_type !== "Event Organizer") return setMessage("This workspace is available to event organizers only.");
      setSupplier(data);
    })();
  }, []);

  if (!supplier.business) return <main className="mx-auto max-w-4xl px-6 py-16"><h1 className="text-3xl font-semibold">Event organizer workspace</h1><p className="mt-3 text-black/60">{message || "Loading your event workspace…"}</p></main>;
  const b = supplier.business;
  const checks = [
    ["Business identity", Boolean(b.name && b.description)],
    ["Customer contact", Boolean(b.phone && b.email)],
    ["Location", Boolean(b.address)],
    ["Website / social proof", Boolean(b.website_url || b.instagram_url || b.facebook_url)],
    ["Media", Boolean(b.logo_url || b.cover_image_url || (b.supplier_gallery_urls || []).length)],
  ];
  const ready = checks.filter(([, done]) => done).length;

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <p className="text-sm uppercase tracking-[.2em] text-black/40">Event organizer</p>
    <h1 className="mt-2 text-4xl font-semibold">Events & experiences</h1>
    <p className="mt-2 max-w-2xl text-black/60">Prepare your organizer profile for SafariPlug curation. Event listings remain subject to review so customers see accurate, trustworthy experiences.</p>

    <section className="mt-8 rounded-2xl border border-black/10 bg-black/[.02] p-5">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-black/40">Listing readiness</p><h2 className="mt-1 text-xl font-semibold">{ready}/{checks.length} foundations ready</h2></div><span className="rounded-full bg-black/[.05] px-3 py-1 text-xs">{supplier.account?.onboarding_status || "draft"}</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">{checks.map(([label, done]) => <div key={String(label)} className="rounded-xl border border-black/10 p-4"><div className="text-sm font-medium">{label}</div><div className="mt-1 text-xs text-black/50">{done ? "Ready" : "Needs attention"}</div></div>)}</div>
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5">
      <h2 className="text-xl font-semibold">What happens next</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Step n="1" title="Complete profile" body="Add accurate organizer details, contact information, location and media." />
        <Step n="2" title="Prepare listing" body="Event and experience creation should capture dates, venue, pricing, capacity and customer instructions." />
        <Step n="3" title="SafariPlug review" body="Listings are verified and curated before they are presented as approved inventory." />
      </div>
      <div className="mt-5 rounded-xl bg-black/[.04] p-4 text-sm leading-6 text-black/60">The current repository has the AI discovery and admin curation workflow, but no confirmed event-organizer write API/schema for supplier-created events. This workspace therefore avoids creating a disconnected shadow event database.</div>
    </section>

    <div className="mt-6 flex flex-wrap gap-3"><Link href="/supplier/onboarding" className="rounded-full bg-black px-5 py-2.5 text-sm text-white">Back to supplier profile</Link><Link href="/admin/ai-events" className="rounded-full border border-black/15 px-5 py-2.5 text-sm">Curation dashboard</Link></div>
    {message && <p className="mt-5 text-sm text-black/60">{message}</p>}
  </main>;
}

function Step({ n, title, body }: { n: string; title: string; body: string }) { return <div className="rounded-xl border border-black/10 p-4"><div className="text-xs uppercase tracking-[.18em] text-black/40">Step {n}</div><div className="mt-1 font-medium">{title}</div><p className="mt-1 text-sm leading-5 text-black/50">{body}</p></div>; }
