"use client";

import { FormEvent, useState } from "react";

type ProbeResult = Record<string, unknown>;

export default function TransferProbe() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/transfers-availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromType: form.get("fromType"),
          fromCode: form.get("fromCode"),
          toType: form.get("toType"),
          toCode: form.get("toCode"),
          outbound: form.get("outbound"),
          inbound: form.get("inbound"),
          adults: Number(form.get("adults") || 1),
          children: Number(form.get("children") || 0),
          infants: Number(form.get("infants") || 0),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Transfers probe failed with HTTP ${response.status}.`);
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfers probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Controlled verification</p>
      <h2 className="mt-2 text-lg font-bold">Run 1 Transfer availability lookup</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">One explicit Availability request only. No supplier booking, booking retrieval, or cancellation call is made.</p>
      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
        <input name="fromType" required placeholder="Pickup type (IATA, ATLAS, GPS...)" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input name="fromCode" required placeholder="Pickup code" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input name="toType" required placeholder="Drop-off type (IATA, ATLAS, GPS...)" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input name="toCode" required placeholder="Drop-off code" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <label className="text-xs text-zinc-500">Outbound<input name="outbound" type="datetime-local" required className="mt-1 w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-zinc-500">Inbound (optional)<input name="inbound" type="datetime-local" className="mt-1 w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white" /></label>
        <input name="adults" type="number" min="1" defaultValue="2" required placeholder="Adults" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3"><input name="children" type="number" min="0" defaultValue="0" placeholder="Children" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" /><input name="infants" type="number" min="0" defaultValue="0" placeholder="Infants" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" /></div>
        <button disabled={busy} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50 md:col-span-2">{busy ? "Checking…" : "Run 1 Transfer availability lookup"}</button>
      </form>
      {error ? <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">{error}</div> : null}
      {result ? <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-5 text-zinc-300">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}
