"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Preflight = {
  selectionToken: string;
  pricing?: {
    supplierAmount?: number;
    supplierCurrency?: string;
    customerRetailAmount?: number;
    customerCurrency?: string;
    exchangeRate?: number;
    markupPercent?: number;
  };
  route?: {
    from?: { type?: string; code?: string };
    to?: { type?: string; code?: string };
    outbound?: string;
    inbound?: string | null;
    adults?: number;
    children?: number;
    infants?: number;
  };
  cancellationPolicies?: Array<{ amount?: number | null; from?: string | null; currencyId?: string | null }>;
  service?: { transferType?: string | null; vehicleName?: string | null; maxPaxCapacity?: number | null };
};

export default function HotelbedsTransferBookPage() {
  const params = useMemo(
    () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
    []
  );
  const initialToken = params.get("selectionToken") || "";
  const [selectionToken, setSelectionToken] = useState(initialToken);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [holder, setHolder] = useState({ name: "", surname: "", email: "", phone: "" });
  const [flightCode, setFlightCode] = useState("");
  const [flightCompany, setFlightCompany] = useState("");
  const [flightDirection, setFlightDirection] = useState<"ARRIVAL" | "DEPARTURE">("ARRIVAL");

  useEffect(() => {
    if (!initialToken) {
      setLoading(false);
      setError("This transfer selection is missing or expired. Please search again.");
      return;
    }

    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/v1/transfers/hotelbeds/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "preflight",
            selectionToken: initialToken,
            currency: "KES",
          }),
        });
        const body = await response.json();
        if (response.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!response.ok) throw new Error(body?.message || "Unable to verify the selected transfer.");
        if (!body?.selectionToken) throw new Error("SafariPlug did not return a governed transfer selection.");
        if (!cancelled) {
          setSelectionToken(body.selectionToken);
          setPreflight(body);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to verify the selected transfer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!preflight || !selectionToken) {
      setError("Transfer verification must finish before payment.");
      return;
    }
    if (!accepted) {
      setError("Review and accept the transfer terms before payment.");
      return;
    }
    if (!holder.name.trim() || !holder.surname.trim() || !holder.email.trim() || !holder.phone.trim()) {
      setError("Lead passenger name, email and international phone are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const transferDetails =
        flightCode.trim() || flightCompany.trim()
          ? [
              {
                type: "FLIGHT",
                direction: flightDirection,
                code: flightCode.trim(),
                companyName: flightCompany.trim(),
              },
            ]
          : undefined;

      const response = await fetch("/api/v1/transfers/hotelbeds/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          selectionToken,
          currency: "KES",
          termsAccepted: true,
          customerPhone: holder.phone.trim(),
          holder: {
            name: holder.name.trim(),
            surname: holder.surname.trim(),
            email: holder.email.trim(),
            phone: holder.phone.trim(),
          },
          transferDetails,
        }),
      });
      const body = await response.json();
      if (response.status === 401) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) throw new Error(body?.message || "Unable to start transfer payment.");
      if (!body?.bookingId) throw new Error("SafariPlug did not return a transfer booking session.");
      window.location.href = `/transfers/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(body.bookingId)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start transfer payment.");
      setSubmitting(false);
    }
  }

  const price = preflight?.pricing;
  const route = preflight?.route;
  const policies = preflight?.cancellationPolicies || [];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-[#111]">
      <div className="mx-auto max-w-5xl">
        <Link href="/drivers" className="text-sm font-semibold text-black/55">← Back to transfers</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug / Hotelbeds Transfers</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Review your transfer</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
              SafariPlug verifies the selected supplier rate before payment. No Hotelbeds booking is created until payment succeeds.
            </p>

            <div className="mt-8 rounded-3xl bg-white p-6">
              <h2 className="font-semibold">Transfer verification</h2>
              {loading ? (
                <p className="mt-2 text-sm text-black/55">Verifying the selected Hotelbeds transfer…</p>
              ) : preflight ? (
                <div className="mt-4 space-y-4 text-sm text-black/60">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Pickup" value={`${route?.from?.type || "—"} · ${route?.from?.code || "—"}`} />
                    <Info label="Drop-off" value={`${route?.to?.type || "—"} · ${route?.to?.code || "—"}`} />
                    <Info label="Outbound" value={route?.outbound || "—"} />
                    <Info label="Passengers" value={`${route?.adults || 0} adult · ${route?.children || 0} child · ${route?.infants || 0} infant`} />
                  </div>
                  {preflight.service?.transferType || preflight.service?.vehicleName ? (
                    <p><span className="font-semibold text-black/75">Service:</span> {[preflight.service.transferType, preflight.service.vehicleName].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  <div>
                    <p className="font-semibold text-black/75">Cancellation terms</p>
                    {policies.length ? (
                      <ul className="mt-2 space-y-2">
                        {policies.map((policy, index) => (
                          <li key={index} className="rounded-xl bg-black/[.035] p-3">
                            From {policy.from || "supplier cutoff"}: {policy.currencyId || price?.supplierCurrency || ""} {policy.amount ?? "supplier-defined"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-black/45">No cancellation policy was returned with this selected service.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-red-700">Transfer verification is not complete.</p>
              )}
            </div>
          </section>

          <form onSubmit={checkout} className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-black/40">Passenger & payment</p>
            <div className="mt-4 rounded-2xl bg-black/[.035] p-4">
              <p className="text-xs text-black/45">Verified SafariPlug total</p>
              <p className="mt-1 text-3xl font-semibold">
                {price?.customerCurrency || "KES"} {Number.isFinite(price?.customerRetailAmount) ? Number(price?.customerRetailAmount).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-black/45">M-Pesa is charged first. Supplier confirmation is attempted only after SafariPlug verifies successful payment.</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <input value={holder.name} onChange={(e) => setHolder({ ...holder, name: e.target.value })} placeholder="First name" className="rounded-xl border border-black/10 px-3 py-3" />
              <input value={holder.surname} onChange={(e) => setHolder({ ...holder, surname: e.target.value })} placeholder="Last name" className="rounded-xl border border-black/10 px-3 py-3" />
              <input type="email" value={holder.email} onChange={(e) => setHolder({ ...holder, email: e.target.value })} placeholder="Email" className="rounded-xl border border-black/10 px-3 py-3 sm:col-span-2" />
              <input value={holder.phone} onChange={(e) => setHolder({ ...holder, phone: e.target.value })} placeholder="Phone in E.164, e.g. +2547…" className="rounded-xl border border-black/10 px-3 py-3 sm:col-span-2" />
            </div>

            <div className="mt-6 rounded-2xl border border-black/8 p-4">
              <p className="font-semibold">Flight details <span className="font-normal text-black/35">(optional)</span></p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select value={flightDirection} onChange={(e) => setFlightDirection(e.target.value as "ARRIVAL" | "DEPARTURE")} className="rounded-xl border border-black/10 px-3 py-3">
                  <option value="ARRIVAL">Arrival</option>
                  <option value="DEPARTURE">Departure</option>
                </select>
                <input value={flightCode} onChange={(e) => setFlightCode(e.target.value)} placeholder="Flight number" className="rounded-xl border border-black/10 px-3 py-3" />
                <input value={flightCompany} onChange={(e) => setFlightCompany(e.target.value)} placeholder="Airline" className="rounded-xl border border-black/10 px-3 py-3 sm:col-span-2" />
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-black/8 p-4 text-sm leading-6 text-black/60">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={!preflight || loading} className="mt-1" />
              <span>I reviewed and accept the selected transfer, price, cancellation terms and supplier conditions shown above.</span>
            </label>

            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <button disabled={submitting || loading || !preflight || !accepted} className="mt-6 w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white disabled:opacity-50">
              {submitting ? "Starting M-Pesa payment…" : loading ? "Verifying transfer…" : "Continue with M-Pesa"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black/[.035] p-3"><p className="text-xs text-black/40">{label}</p><p className="mt-1 font-semibold text-black/70">{value}</p></div>;
}
