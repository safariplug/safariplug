"use client";

import { FormEvent, useState } from "react";

type RouteRow = {
  code: string;
  from: { type: string; code: string };
  to: { type: string; code: string };
};

type SearchResult = {
  selectionToken: string;
  supplierAmount: number;
  supplierCurrency: string;
  cancellationPolicies?: Array<{ amount?: number | null; from?: string | null; currencyId?: string | null }>;
  service?: { transferType?: string | null; vehicleName?: string | null; maxPaxCapacity?: number | null };
};

export default function TransferSearchClient({
  routeCatalogueEnabled,
}: {
  routeCatalogueEnabled: boolean;
}) {
  const [destinationCode, setDestinationCode] = useState("");
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteRow | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState("");

  async function findRoutes() {
    if (!routeCatalogueEnabled) return;
    const code = destinationCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a destination code first.");
      return;
    }
    setRouteBusy(true);
    setError("");
    setRoutes([]);
    setSelectedRoute(null);
    setResults([]);
    try {
      const response = await fetch("/api/v1/transfers/hotelbeds/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinationCode: code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to load transfer routes.");
      const rows = Array.isArray(body.routes) ? (body.routes as RouteRow[]) : [];
      setRoutes(rows);
      if (!rows.length) setError("No Hotelbeds routes were returned for that destination.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transfer routes.");
    } finally {
      setRouteBusy(false);
    }
  }

  async function searchAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoute) {
      setError("Choose a valid route first.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSearchBusy(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch("/api/v1/transfers/hotelbeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "availability",
          fromType: selectedRoute.from.type,
          fromCode: selectedRoute.from.code,
          toType: selectedRoute.to.type,
          toCode: selectedRoute.to.code,
          outbound: form.get("outbound"),
          inbound: form.get("inbound") || undefined,
          adults: Number(form.get("adults") || 1),
          children: Number(form.get("children") || 0),
          infants: Number(form.get("infants") || 0),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to search transfer availability.");
      const rows = Array.isArray(body.results) ? (body.results as SearchResult[]) : [];
      setResults(rows);
      if (!rows.length) setError("No transfer services were returned for this route and time.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search transfer availability.");
    } finally {
      setSearchBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
      <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Connected supplier search</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Find a transfer</h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          SafariPlug only searches Hotelbeds after you explicitly request a route or availability check.
        </p>

        {!routeCatalogueEnabled ? (
          <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">Live Hotelbeds route discovery is temporarily unavailable.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900/70">
              SafariPlug is waiting for Hotelbeds to confirm Transfers Cache Routes access. No supplier lookup is performed from this page while that capability is disabled.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wide text-black/40">Destination code</label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  value={destinationCode}
                  onChange={(e) => setDestinationCode(e.target.value.toUpperCase())}
                  placeholder="Destination code"
                  className="flex-1 rounded-xl border border-black/10 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() => void findRoutes()}
                  disabled={routeBusy}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {routeBusy ? "Finding routes…" : "Find routes"}
                </button>
              </div>
            </div>

            {routes.length ? (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Available route pairs</p>
                {routes.map((route) => (
                  <button
                    key={route.code}
                    type="button"
                    onClick={() => {
                      setSelectedRoute(route);
                      setResults([]);
                      setError("");
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm ${selectedRoute?.code === route.code ? "border-black bg-black text-white" : "border-black/10 bg-white"}`}
                  >
                    <span className="font-semibold">{route.from.type} {route.from.code}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold">{route.to.type} {route.to.code}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={searchAvailability} className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-black/45">
                Outbound
                <input name="outbound" type="datetime-local" required className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" />
              </label>
              <label className="text-xs text-black/45">
                Inbound <span className="text-black/30">(optional)</span>
                <input name="inbound" type="datetime-local" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" />
              </label>
              <label className="text-xs text-black/45">
                Adults
                <input name="adults" type="number" min="1" defaultValue="2" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-black/45">
                  Children
                  <input name="children" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" />
                </label>
                <label className="text-xs text-black/45">
                  Infants
                  <input name="infants" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm" />
                </label>
              </div>
              <button
                disabled={!selectedRoute || searchBusy}
                className="rounded-xl bg-[#111] px-5 py-3 font-semibold text-white disabled:opacity-40 sm:col-span-2"
              >
                {searchBusy ? "Searching Hotelbeds…" : "Search availability"}
              </button>
            </form>
          </>
        )}

        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Available services</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Choose your ride</h2>
        {!results.length ? (
          <div className="mt-5 rounded-[1.75rem] border border-dashed border-black/15 bg-white p-8 text-sm leading-6 text-black/50">
            {routeCatalogueEnabled
              ? "Search a valid route to see live Hotelbeds transfer services. SafariPlug does not invent vehicles, prices or availability."
              : "Live supplier services will appear here after Hotelbeds confirms route-catalogue access. Verified SafariPlug drivers remain available separately."}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {results.map((result, index) => (
              <article key={result.selectionToken} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">Hotelbeds transfer</p>
                    <h3 className="mt-2 text-xl font-semibold">
                      {result.service?.vehicleName || result.service?.transferType || `Transfer option ${index + 1}`}
                    </h3>
                    {result.service?.maxPaxCapacity ? (
                      <p className="mt-1 text-sm text-black/45">Up to {result.service.maxPaxCapacity} passengers</p>
                    ) : null}
                  </div>
                  <p className="text-xl font-semibold">
                    {result.supplierCurrency} {Number(result.supplierAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                {result.cancellationPolicies?.length ? (
                  <p className="mt-4 text-xs leading-5 text-black/45">
                    Cancellation terms are available and will be shown again before payment.
                  </p>
                ) : null}
                <a
                  href={`/transfers/hotelbeds-book?selectionToken=${encodeURIComponent(result.selectionToken)}`}
                  className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
                >
                  Review & book →
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
