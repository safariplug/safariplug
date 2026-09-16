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
type Row = Supplier & { businessName: string; businessEmail: string; ageDays: number; priority: number; reason: string; owner: "staff" | "supplier" | "active" | "closed" };
type FollowupDraft = { supplierId: string; businessName: string; recipient: string; subject: string; message: string };

function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }
function daysSince(value?: string | null) { if (!value) return 0; const time = new Date(value).getTime(); return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 0; }
function statusLabel(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function SupplierReadinessQueuePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [drafting, setDrafting] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<FollowupDraft | null>(null);

  async function load() {
    const response = await fetch("/api/admin/suppliers/review", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { suppliers?: Supplier[]; error?: string } | null;
    if (!response.ok) return setError(data?.error || "Unable to load supplier readiness.");
    setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
  }

  useEffect(() => { void load(); }, []);

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

    return { ...supplier, businessName: business?.name || supplier.contact_name || "Unnamed supplier", businessEmail: business?.email || "", ageDays: reviewAge || createdAge, priority, reason, owner };
  }).filter((row) => `${row.businessName} ${row.contact_name || ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.priority - b.priority || b.ageDays - a.ageDays), [suppliers, query]);

  const staffCount = rows.filter((row) => row.owner === "staff").length;
  const stalledCount = rows.filter((row) => row.owner === "supplier" && row.priority <= 25).length;
  const activeCount = rows.filter((row) => row.owner === "active").length;

  async function draftFollowup(row: Row) {
    setDrafting(row.id); setError(""); setMessage("");
    const response = await fetch("/api/admin/suppliers/followup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplierId: row.id, action: "draft" }),
    });
    const data = await response.json().catch(() => null) as { recipient?: string; subject?: string; message?: string; error?: string } | null;
    setDrafting("");
    if (!response.ok) return setError(data?.error || "Unable to draft supplier follow-up.");
    setDraft({ supplierId: row.id, businessName: row.businessName, recipient: data?.recipient || row.businessEmail, subject: data?.subject || "", message: data?.message || "" });
  }

  async function sendFollowup() {
    if (!draft) return;
    setSending(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/suppliers/followup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplierId: draft.supplierId, action: "send", subject: draft.subject, message: draft.message }),
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setSending(false);
    if (!response.ok) return setError(data?.error || "Unable to send supplier follow-up.");
    setMessage(`Follow-up email sent to ${draft.recipient}.`);
    setDraft(null);
    await load();
  }

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Admin · Supplier Operations</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">Readiness & nudge queue</h1></div><Link href="/admin/suppliers" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to suppliers</Link></div>
    <p className="mt-3 max-w-3xl text-black/55">Zero-cost prioritization using existing supplier status, completion and timestamps. AI is used only when staff explicitly asks SafariPlug to draft a follow-up.</p>

    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Needs staff review" value={staffCount} /><Metric label="Supplier follow-up candidates" value={stalledCount} /><Metric label="Approved / live" value={activeCount} /></section>

    <section className="mt-6 rounded-2xl border border-black/10 p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier or contact" className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></section>
    {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}

    <section className="mt-6 space-y-3">{rows.map((row) => {
      const canFollowup = row.owner === "supplier" && ["draft", "onboarding", "changes_requested"].includes(row.onboarding_status) && Boolean(row.businessEmail);
      return <article key={row.id} className={`rounded-2xl border p-5 ${row.owner === "staff" ? "border-amber-200 bg-amber-50" : row.owner === "active" ? "border-emerald-200 bg-emerald-50" : "border-black/10 bg-white"}`}>
        <div className="grid gap-4 md:grid-cols-[1.1fr_.55fr_1.35fr_auto] md:items-center">
          <div><h2 className="font-semibold">{row.businessName}</h2><p className="mt-1 text-sm text-black/50">{row.contact_name || "No contact name"}</p><p className="mt-1 text-xs text-black/35">{row.businessEmail || "No business email"}</p></div>
          <div><p className="text-xs text-black/40">Progress</p><p className="mt-1 text-lg font-semibold">{row.completion_percent}%</p></div>
          <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-black/[.06] px-2.5 py-1 text-[11px]">{statusLabel(row.onboarding_status)}</span>{row.ageDays > 0 && <span className="rounded-full bg-black/[.06] px-2.5 py-1 text-[11px]">{row.ageDays}d</span>}</div><p className="mt-2 text-sm text-black/60">{row.reason}</p></div>
          <div className="flex flex-wrap gap-2">{canFollowup && <button onClick={() => void draftFollowup(row)} disabled={drafting === row.id} className="rounded-full border border-black/15 px-3 py-2 text-sm font-semibold disabled:opacity-40">{drafting === row.id ? "Drafting…" : "Draft follow-up"}</button>}<Link href={`/admin/suppliers/ai-review?supplier=${encodeURIComponent(row.id)}`} className="rounded-full border border-black/15 px-3 py-2 text-sm font-semibold">AI review</Link><Link href="/admin/suppliers" className="rounded-full bg-black px-3 py-2 text-sm font-semibold text-white">Open queue</Link></div>
        </div>
      </article>;
    })}{!rows.length && !error && <div className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/50">No suppliers match this view.</div>}</section>

    <section className="mt-6 rounded-2xl bg-black/[.03] p-5"><h2 className="font-semibold">Nudge policy</h2><p className="mt-1 text-sm leading-6 text-black/55">SafariPlug may draft a reminder only when staff clicks Draft follow-up. Staff can edit everything. No email is sent until staff explicitly clicks Send email. Submitted, approved/live, and rejected suppliers are excluded from this follow-up path.</p></section>

    {draft && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Human approval required</p><h2 className="mt-1 text-2xl font-semibold">Supplier follow-up draft</h2><p className="mt-1 text-sm text-black/50">{draft.businessName} · {draft.recipient}</p></div><button onClick={() => setDraft(null)} className="rounded-full border border-black/10 px-3 py-1.5 text-sm">Close</button></div>
        <label className="mt-6 block text-sm font-medium">Subject<input value={draft.subject} onChange={(event) => setDraft((current) => current ? { ...current, subject: event.target.value } : current)} className="mt-2 w-full rounded-xl border border-black/15 px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Message<textarea value={draft.message} onChange={(event) => setDraft((current) => current ? { ...current, message: event.target.value } : current)} rows={14} className="mt-2 w-full rounded-2xl border border-black/15 px-4 py-3" /></label>
        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-black/60 ring-1 ring-amber-200">Review the recipient, subject and message carefully. AI suggestions are drafts only. Clicking Send email is the explicit staff approval action.</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => setDraft(null)} className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-semibold">Cancel</button><button onClick={() => void sendFollowup()} disabled={sending || !draft.subject.trim() || !draft.message.trim()} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{sending ? "Sending…" : "Send email"}</button></div>
      </div>
    </div>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
