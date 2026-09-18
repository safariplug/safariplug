"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatusResponse = {
  status: "confirmed" | "payment_pending" | "failed" | "cancelled";
  supplierStatus?: string;
  reconciliation?: string;
  bookingReference?: string;
  message?: string;
  ledger?: {
    provider_booking_reference?: string | null;
    booking_status?: string;
    payment_status?: string;
    retail_amount?: number;
    customer_currency?: string;
    metadata?: Record<string, unknown>;
  };
  providerBooking?: unknown;
};

export default function ActivityBookingResultPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const bookingId = params.get("bookingId") || "";
  const [state, setState] = useState<"loading" | "confirmed" | "pending" | "failed" | "cancelled">("loading");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cancelPreview, setCancelPreview] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    const response = await fetch("/api/v1/activities/hotelbeds/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, bookingId, ...extra }),
      cache: "no-store",
    });
    const body = await response.json();
    if (response.status === 401) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      throw new Error("Authentication required.");
    }
    if (!response.ok) throw new Error(body?.message || "Unable to verify your activity booking.");
    return body as StatusResponse & Record<string, unknown>;
  }

  useEffect(() => {
    if (!bookingId) {
      setState("failed");
      setError("We could not identify this activity booking.");
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    let attempt = 0;
    const check = async () => {
      attempt += 1;
      setAttempts(attempt);
      try {
        const result = await call("status");
        if (cancelled) return;
        setData(result);
        if (result.status === "confirmed") { setState("confirmed"); return; }
        if (result.status === "failed") { setState("failed"); setError(result.message || "The activity booking was not completed."); return; }
        if (result.status === "cancelled") { setState("cancelled"); return; }
        setState("pending");
        if (result.reconciliation === "manual_required") return;
        if (attempt < 12) timer = window.setTimeout(check, 5000);
      } catch (err) {
        if (cancelled) return;
        setState("failed");
        setError(err instanceof Error ? err.message : "Unable to verify your activity booking.");
      }
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [bookingId]);

  async function previewCancellation() {
    setBusy(true); setError("");
    try {
      const result = await call("cancel_preview");
      setCancelPreview(result.preview || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview cancellation.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancellation() {
    setBusy(true); setError("");
    try {
      const result = await call("cancel", { confirmCancellation: true });
      setData(result); setState("cancelled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel activity.");
    } finally {
      setBusy(false);
    }
  }

  const reference = data?.bookingReference || data?.ledger?.provider_booking_reference || "—";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        {state === "loading" ? <Status title="Checking your activity booking…" body="SafariPlug is verifying M-Pesa and Hotelbeds reconfirmation." attempts={attempts} /> : null}
        {state === "pending" ? <Status title={data?.reconciliation === "manual_required" ? "Payment received — supplier reconfirmation needs review" : "Your activity is being confirmed"} body={data?.message || "The activity is preconfirmed while SafariPlug verifies payment and final supplier status."} attempts={attempts} /> : null}
        {state === "failed" ? <Status title="Activity booking needs attention" body={error || "The activity could not be confirmed."} attempts={attempts} /> : null}
        {state === "cancelled" ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Activity cancelled</p>
            <h1 className="mt-2 text-3xl font-bold">Hotelbeds activity</h1>
            <p className="mt-4 text-sm text-gray-600">Supplier cancellation is recorded. Any customer refund due is handled separately and is not automatically issued by this action.</p>
          </>
        ) : null}
        {state === "confirmed" ? (
          <>
            <div className="mb-6 text-4xl">✓</div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Activity confirmed</p>
            <h1 className="mt-2 text-3xl font-bold">Your activity is booked</h1>
            <div className="mt-6 rounded-2xl bg-gray-50 p-5">
              <p className="text-xs text-gray-500">Hotelbeds booking reference</p>
              <p className="mt-1 font-semibold">{reference}</p>
            </div>
            <div className="mt-6 rounded-2xl border p-5">
              <h2 className="font-semibold">Manage activity</h2>
              {!cancelPreview ? (
                <button disabled={busy} onClick={previewCancellation} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Checking…" : "Preview cancellation"}</button>
              ) : (
                <>
                  <p className="mt-3 text-sm text-gray-600">Hotelbeds cancellation simulation completed. Review the supplier response before confirming.</p>
                  <details className="mt-3 text-xs text-gray-500"><summary>Supplier simulation details</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(cancelPreview, null, 2)}</pre></details>
                  <button disabled={busy} onClick={confirmCancellation} className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Cancelling…" : "Confirm cancellation"}</button>
                </>
              )}
            </div>
          </>
        ) : null}
        {error && state !== "failed" ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {(state === "failed" || (state === "pending" && attempts >= 12)) ? <button className="rounded-xl border px-4 py-2 font-medium" onClick={() => window.location.reload()}>Check again</button> : null}
          <Link className="rounded-xl bg-black px-4 py-2 font-medium text-white" href="/account">My account</Link>
          <Link className="rounded-xl border px-4 py-2 font-medium" href="/activities">Find another activity</Link>
        </div>
      </div>
    </main>
  );
}

function Status({ title, body, attempts }: { title: string; body: string; attempts: number }) {
  return <>
    <div className="mb-6 h-10 w-10 animate-pulse rounded-full border-4 border-gray-200 border-t-black" />
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="mt-3 text-gray-600">{body}</p>
    {attempts > 0 ? <p className="mt-3 text-xs text-gray-400">Verification attempt {attempts} of 12</p> : null}
  </>;
}
