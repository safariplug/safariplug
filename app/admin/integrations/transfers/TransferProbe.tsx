"use client";

import { FormEvent, useState } from "react";

type ProbeResult = Record<string, unknown>;
type RouteRow = {
  code: string;
  from: { type: string; code: string };
  to: { type: string; code: string };
};

function nonJsonPayload(response: Response, text: string): ProbeResult {
  const trimmed = text.trim();
  return {
    ok: false,
    error: `SafariPlug transfer probe returned non-JSON HTTP ${response.status}.`,
    httpStatus: response.status,
    responseType: trimmed.startsWith("<") ? "html" : "text",
    supplierRequestCount: null,
    bookingCreated: false,
  };
}

function failureMessage(payload: ProbeResult, responseStatus: number) {
  const base = typeof payload.error === "string"
    ? payload.error
    : `Transfers probe failed with HTTP ${responseStatus}.`;
  const supplierCode = typeof payload.supplierCode === "string" ? payload.supplierCode : "";
  const supplierStatus = typeof payload.supplierStatus === "number" ? payload.supplierStatus : null;
  const details = [
    supplierStatus ? `Supplier HTTP ${supplierStatus}` : "",
    supplierCode ? `Supplier code ${supplierCode}` : "",
  ].filter(Boolean);
  return details.length ? `${base} ${details.join(" · ")}.` : base;
}

async function readPayload(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as ProbeResult) : {};
  } catch {
    return nonJsonPayload(response, text);
  }
}

export default function TransferProbe() {
  const [busy, setBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [destinationCode, setDestinationCode] = useState("");
  const [fromType, setFromType] = useState("");
  const [fromCode, setFromCode] = useState("");
  const [toType, setToType] = useState("");
  const [toCode, setToCode] = useState("");

  async function lookupRoutes() {
    const code = destinationCode.trim().toUpperCase();
    if (!code) {
      setCatalogError("Enter a Hotelbeds destination code first.");
      return;
    }
    setCatalogBusy(true);
    setCatalogError("");
    setRoutes([]);
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/transfers-routes", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ destinationCode: code }),
      });
      const payload = await readPayload(response);
      if (!response.ok || payload.ok === false) {
        setCatalogError(failureMessage(payload, response.status));
        return;
      }
      const rows = Array.isArray(payload.routes) ? payload.routes as RouteRow[] : [];
      setRoutes(rows);
      if (!rows.length) setCatalogError("No routes were returned for that destination code.");
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Transfer route lookup failed.");
    } finally {
      setCatalogBusy(false);
    }
  }

  function useRoute(route: RouteRow) {
    setFromType(route.from.type);
    setFromCode(route.from.code);
    setToType(route.to.type);
    setToCode(route.to.code);
    setError("");
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/transfers-availability", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          fromType,
          fromCode,
          toType,
          toCode,
          outbound: form.get("outbound"),
          inbound: form.get("inbound"),
          adults: Number(form.get("adults") || 1),
          children: Number(form.get("children") || 0),
          infants: Number(form.get("infants") || 0),
        }),
      });

      const payload = await readPayload(response);
      setResult(payload);
      if (!response.ok || payload.ok === false) {
        setError(failureMessage(payload, response.status));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfers probe failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Controlled verification</p>
      <h2 className="mt-2 text-lg font-bold">Hotelbeds Transfers route verification</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Look up a valid Hotelbeds route first, select it, then run one explicit Availability request. No booking, retrieval, or cancellation call is made.
      </p>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-black/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Step 1 · Route catalogue</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            value={destinationCode}
            onChange={(event) => setDestinationCode(event.target.value.toUpperCase())}
            placeholder="Destination code, e.g. PMI"
            className="flex-1 rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={lookupRoutes}
            disabled={catalogBusy}
            className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-50"
          >
            {catalogBusy ? "Loading routes…" : "Find valid routes"}
          </button>
        </div>
        {catalogError ? <div className="mt-3 text-sm text-red-300">{catalogError}</div> : null}
        {routes.length ? (
          <div className="mt-4 max-h-72 space-y-2 overflow-auto">
            {routes.map((route) => (
              <button
                key={route.code}
                type="button"
                onClick={() => useRoute(route)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs hover:border-amber-400/50"
              >
                <span className="font-mono text-zinc-300">{route.code}</span>
                <span className="text-amber-300">Use route</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
        <input value={fromType} onChange={(e) => setFromType(e.target.value.toUpperCase())} required placeholder="Pickup type" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input value={fromCode} onChange={(e) => setFromCode(e.target.value)} required placeholder="Pickup code" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input value={toType} onChange={(e) => setToType(e.target.value.toUpperCase())} required placeholder="Drop-off type" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
        <input value={toCode} onChange={(e) => setToCode(e.target.value)} required placeholder="Drop-off code" className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm" />
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
