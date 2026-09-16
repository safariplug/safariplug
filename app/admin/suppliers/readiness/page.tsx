"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Business = { name?: string | null; email?: string | null; phone?: string | null; description?: string | null; logo_url?: string | null; cover_image_url?: string | null };
type Supplier = {
  id: string;
  contact_name?: string | null;
  onboarding_status: string;
  completion_percent: number;
  submitted_at?: string | null;
  created_at?: string | null;
  review_requested_at?: string | null;
  review_items?: string[] | null;
  businesses?: Business | Business[] | null;
};
type Row = Supplier & { businessName: string; ageDays: number; priority: number; reason: string; owner: "staff" | "supplier" | "active" | "closed" };

function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }
function daysSince(value?: string | null) { if (!value) return 0; const time = new Date(value).getTime(); return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 0; }
function statusLabel(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function SupplierReadinessQueuePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => { void (async () => {
    const response = await fetch("/api/admin/suppliers/review", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { suppliers?: Supplier[]; error?: string } | null;
    if (!response.ok) return setError(data?.error || "Unable to load supplier readiness.");
    setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
  })(); }, []);

  const rows = useMemo<Row[]>(() => suppliers.map((supplier) => {
    const business = first(supplier.businesses);
    const status = supplier.onboarding_status;
    const reviewAge = daysSince(supplier.review_requested_at || supplier.submitted_at || supplier.created_at);
    const createdAge = daysSince(supplier.created_at);
    let priority = 50;
    let reason = "No urgent action.";
    let owner: Row["owner"] = "supplier";

    if (status === "submitted") { priority = 0; owner = "staff"; reason = `Awaiting human review${reviewAge ? ` for ${reviewAge} day${reviewAge === 1 ? "" : "s"}` : ""}.`; }
    else if (status === "changes_requested") { priority = reviewAge >= 7 ? 5 : 15; owner = "supplier"; reason = `${supplier.review_items?.length || 0} requested fix${supplier.review_items?.length === 1 ? "" : "es"} outstanding${reviewAge ? ` for ${reviewAge} days` : ""}.`; }
    else if (["approved", "live"].includes(status)) { priority = 90; owner = "active"; reason = "Approved or live supplier."; }
    else if (status === "rejected") { priority = 99; owner = "closed"; reason = "Closed supplier record."; }
    else if ((supplier.completion_percent || 0) >= 80) { priority = createdAge >= 3 ? 10 : 20; owner = "supplier"; reason = `Profile is ${supplier.completion_percent}% complete but has not been submitted.`; }
    else if (createdAge >= 14) { priority = 12; owner = "supplier"; reason = `Onboarding appears stalled for ${createdAge} days at ${supplier.completion_percent}% complete.`; }
    else if (createdAge >= 7) { priority = 25; owner = "supplier"; reason = `No submission after ${createdAge} days; ${supplier.completion_percent}% complete.`; }
    else { priority = 40; owner = "supplier"; reason = `Onboarding in progress at ${supplier.completion_percent}% complete.`; }

    return { ...supplier, businessName: business?.name || supplier.contact_name || "Unnamed supplier", ageDays: reviewAge || createdAge, priority, reason, owner };
  }).filter((row) => `${row.businessName} ${row.contact_name || ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.priority - b.priority || b.ageDays - a.ageDays), [suppliers, query]);

  const staffCount = rows.filter((row) => row.owner === "staff").length;
  const stalledCount = rows.filter((row) => row.owner === "supplier" && row.priority <= 25).length;
  const activeCount = rows.filter((row) => row.owner === "active").length;

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Admin · Supplier Operations</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">Readiness & nudge queue</h1></div><Link href="/admin/suppliers" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to suppliers</Link></div>
    <p className="mt-3 max-w-3xl text-black/55">Zero-cost prioritization using existing supplier status, completion and timestamps. No AI call is required to identify who needs attention.</p>

    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Needs staff review" value={staffCount} /><Metric label="Supplier follow-up candidates" value={stalledCount} /><Metric label="Approved / live" value={activeCount} /></section>

    <section className="mt-6 rounded-2xl border border-black/10 p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier or contact" className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></section>
    {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <section className="mt-6 space-y-3">{rows.map((row) => <article key={row.id} className={`rounded-2xl border p-5 ${row.owner === "staff" ? "border-amber-200 bg-amber-50" : row.owner === "active" ? "border-emerald-200 bg-emerald-50" : "border-black/10 bg-white"}`}>
      <div className="grid gap-4 md:grid-cols-[1.1fr_.55fr_1.35fr_auto] md:items-center">
        <div><h2 className="font-semibold">{row.businessName}</h2><p className="mt-1 text-sm text-black/50">{row.contact_name || "No contact name"}</p></div>
        <div><p className="text-xs text-black/40">Progress</p><p className="mt-1 text-lg font-semibold">{row.completion_percent}%</p></div>
        <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-black/[.06] px-2.5 py-1 text-[11px]">{statusLabel(row.onboarding_status)}</span>{row.ageDays > 0 && <span className="rounded-full bg-black/[.06] px-2.5 py-1 text-[11px]">{row.ageDays}d</span>}</div><p className="mt-2 text-sm text-black/60">{row.reason}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={`/admin/suppliers/ai-review?supplier=${encodeURIComponent(row.id)}`} className="rounded-full border border-black/15 px-3 py-2 text-sm font-semibold">AI review</Link><Link href="/admin/suppliers" className="rounded-full bg-black px-3 py-2 text-sm font-semibold text-white">Open queue</Link></div>
      </div>
    </article>)}{!rows.length && !error && <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/50">No suppliers match this view.</div>}</section>

    <section className="mt-6 rounded-2xl bg-black/[.03] p-5"><h2 className="font-semibold">Nudge policy</h2><p className="mt-1 text-sm leading-6 text-black/55">This page only identifies candidates. It does not send emails or messages automatically. Follow-up drafting and sending remain human-controlled.</p></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
