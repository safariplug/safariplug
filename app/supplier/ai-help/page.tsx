"use client";

import Link from "next/link";
import { useState } from "react";

const starters = [
  "What should I complete next?",
  "Help me improve my business description.",
  "Explain the changes SafariPlug requested.",
  "Help me describe my services clearly.",
];

export default function SupplierAIHelpPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(value = question) {
    const q = value.trim();
    if (!q) return;
    setQuestion(q); setLoading(true); setError(""); setAnswer("");
    const response = await fetch("/api/supplier/ai-assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return setError(data?.error || "Unable to get AI help.");
    setAnswer(data?.answer || "No guidance returned.");
  }

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Supplier</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">AI onboarding helper</h1></div><Link href="/supplier" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to onboarding</Link></div>
    <p className="mt-3 max-w-2xl text-black/55">Ask for help with descriptions, requested fixes, services, or what to do next. AI gives suggestions only; review everything before saving.</p>

    <section className="mt-7 rounded-3xl border border-black/10 p-5 md:p-6">
      <label className="text-sm font-medium">What do you need help with?</label>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="For example: Help me improve my business description without inventing anything." className="mt-2 w-full rounded-2xl border border-black/15 px-4 py-3" />
      <div className="mt-3 flex flex-wrap gap-2">{starters.map((starter) => <button key={starter} onClick={() => void ask(starter)} className="rounded-full bg-black/[.04] px-3 py-2 text-sm text-black/65 hover:bg-black/[.08]">{starter}</button>)}</div>
      <button onClick={() => void ask()} disabled={loading || !question.trim()} className="mt-5 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{loading ? "Thinking…" : "Ask SafariPlug AI"}</button>
    </section>

    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {answer && <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 md:p-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800/60">AI suggestion</p><div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/75">{answer}</div><p className="mt-4 text-xs text-black/45">Review this suggestion before copying it into your supplier profile.</p></section>}
  </main>;
}
