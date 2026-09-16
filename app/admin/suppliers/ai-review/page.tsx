"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Supplier = { id: string; contact_name?: string | null; onboarding_status: string; completion_percent: number; businesses?: { name?: string | null } | { name?: string | null }[] | null };
type AIReviewResponse = {
  answer?: string;
  summary?: string;
  complete?: string[];
  issues?: string[];
  questions?: string[];
  suggestedReviewItems?: string[];
  draftReviewNote?: string;
  error?: string;
};

function businessName(supplier: Supplier) {
  const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
  return business?.name || supplier.contact_name || "Unnamed supplier";
}

const prompts = [
  "Summarize this supplier and suggest review items.",
  "What appears incomplete or inconsistent?",
  "Draft a concise review note for staff to edit.",
  "What questions should we ask before approval?",
];

const reviewOptions = [
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

export default function StaffSupplierAIReviewPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [prompt, setPrompt] = useState(prompts[0]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reviewItems, setReviewItems] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => { void (async () => {
    const response = await fetch("/api/admin/suppliers/review", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setError(data?.error || "Unable to load suppliers.");
    const list = Array.isArray(data?.suppliers) ? data.suppliers : [];
    setSuppliers(list);
    if (list[0]) setSupplierId(list[0].id);
  })(); }, []);

  function resetDraft() {
    setAnswer("");
    setReviewItems([]);
    setReviewNote("");
    setSent(false);
  }

  async function run(value = prompt) {
    if (!supplierId) return;
    setPrompt(value); setLoading(true); setAnswer(""); setError(""); setSent(false);
    const response = await fetch("/api/admin/suppliers/ai-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplierId, prompt: value }) });
    const data = await response.json().catch(() => null) as AIReviewResponse | null;
    setLoading(false);
    if (!response.ok) return setError(data?.error || "Unable to generate AI review.");
    setAnswer(data?.answer || "No review returned.");
    setReviewItems(Array.isArray(data?.suggestedReviewItems) ? data.suggestedReviewItems : []);
    setReviewNote(data?.draftReviewNote || "");
  }

  function toggleReviewItem(value: string) {
    setReviewItems((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function sendRequestedChanges() {
    if (!supplierId || (!reviewItems.length && !reviewNote.trim())) return;
    setSending(true); setError(""); setSent(false);
    const response = await fetch("/api/admin/suppliers/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplierId, action: "request_changes", reviewItems, reviewNote }),
    });
    const data = await response.json().catch(() => null);
    setSending(false);
    if (!response.ok) return setError(data?.error || "Unable to send requested changes.");
    setSent(true);
    setSuppliers((current) => current.map((supplier) => supplier.id === supplierId ? { ...supplier, onboarding_status: "changes_requested" } : supplier));
  }

  const selected = suppliers.find((supplier) => supplier.id === supplierId);
  const canSendChanges = selected && ["submitted", "changes_requested"].includes(selected.onboarding_status) && (reviewItems.length > 0 || reviewNote.trim().length > 0);

  return <main className="mx-auto max-w-5xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Admin · Supplier Operations</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">AI supplier review assistant</h1></div><Link href="/admin/suppliers" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to suppliers</Link></div>
    <p className="mt-3 max-w-3xl text-black/55">AI summarizes the record and prepares review suggestions. Staff must inspect, edit and explicitly send any requested changes. AI cannot approve, reject, verify, publish, or activate a supplier.</p>

    <section className="mt-7 rounded-3xl border border-black/10 p-5 md:p-6">
      <label className="text-sm font-medium">Supplier</label>
      <select value={supplierId} onChange={(event) => { setSupplierId(event.target.value); resetDraft(); }} className="mt-2 w-full rounded-xl border border-black/15 px-3 py-2.5">
        {!suppliers.length && <option value="">No suppliers available</option>}
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{businessName(supplier)} · {supplier.onboarding_status.replaceAll("_", " ")} · {supplier.completion_percent}%</option>)}
      </select>

      {selected && <div className="mt-4 rounded-2xl bg-black/[.025] p-4 text-sm"><strong>{businessName(selected)}</strong><span className="ml-2 text-black/45">{selected.onboarding_status.replaceAll("_", " ")} · {selected.completion_percent}% complete</span></div>}

      <label className="mt-5 block text-sm font-medium">What should AI review?</label>
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-black/15 px-4 py-3" />
      <div className="mt-3 flex flex-wrap gap-2">{prompts.map((item) => <button key={item} onClick={() => void run(item)} className="rounded-full bg-black/[.04] px-3 py-2 text-sm text-black/65 hover:bg-black/[.08]">{item}</button>)}</div>
      <button onClick={() => void run()} disabled={loading || !supplierId || !prompt.trim()} className="mt-5 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{loading ? "Reviewing…" : "Generate review draft"}</button>
    </section>

    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {sent && <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Requested changes were sent by staff. The supplier can now fix the selected items and resubmit.</div>}

    {answer && <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-900/60">AI recommendation · Human review required</p>{supplierId && <Link href={`/admin/ai-sales/partners/${supplierId}`} className="text-sm font-semibold underline-offset-4 hover:underline">Open Partner 360</Link>}</div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/75">{answer}</div>

      <div className="mt-6 border-t border-amber-900/10 pt-6">
        <h2 className="text-lg font-semibold">Editable review draft</h2>
        <p className="mt-1 text-sm text-black/55">These are AI suggestions only. Check every item before sending.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{reviewOptions.map(([value, label]) => <label key={value} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm"><input type="checkbox" checked={reviewItems.includes(value)} onChange={() => toggleReviewItem(value)} /><span>{label}</span></label>)}</div>
        <label className="mt-5 block text-sm font-medium">Message to supplier</label>
        <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={2000} rows={6} className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-4 py-3" />
        {!selected || !["submitted", "changes_requested"].includes(selected.onboarding_status) ? <p className="mt-4 text-sm text-black/50">This supplier is not currently in a review state, so the draft cannot be sent.</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={() => void sendRequestedChanges()} disabled={!canSendChanges || sending} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{sending ? "Sending…" : "Send requested changes"}</button><span className="text-xs text-black/45">Nothing is sent until staff clicks this button.</span></div>
      </div>
    </section>}
  </main>;
}
