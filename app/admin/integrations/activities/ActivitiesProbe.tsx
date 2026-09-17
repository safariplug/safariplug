"use client";

import { FormEvent, useState } from "react";

type ProbeResult = Record<string, unknown>;

export default function ActivitiesProbe() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ages = String(form.get("ages") || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/activities-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinationCode: form.get("destinationCode"),
          from: form.get("from"),
          to: form.get("to"),
          ages,
          text: form.get("text"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Activities probe failed with HTTP ${response.status}.`);
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activities probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Controlled verification</p>
      <h2 className="mt-2 text-lg font-bold">Run 1 Activities search</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">One explicit supplier search only. No details/check-rate, preconfirm, booking, or cancellation call is made.</p>
      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
        <input name="destinationCode" required placeholder="Destination code (e.g. supplier destination code)" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input name="text" placeholder="Optional text filter" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <label className="text-xs text-zinc-500">From<input name="from" type="date" required className="mt-1 w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-zinc-500">To<input name="to" type="date" required className="mt-1 w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
        <input name="ages" required placeholder="Passenger ages, comma separated (e.g. 35,32)" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm md:col-span-2" />
        <button disabled={busy} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50 md:col-span-2">{busy ? "Searching…" : "Run 1 Activities search"}</button>
      </form>
      {error ? <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">{error}</div> : null}
      {result ? <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-5 text-zinc-300">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}
