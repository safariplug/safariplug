"use client";

import { useState } from "react";

export default function LockTripReconciliationActions({
  ledgerId,
  preparedBookingId,
}: {
  ledgerId: string;
  preparedBookingId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function verify() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/locktrip/hotels-reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify_current_state",
          ledgerId,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "LockTrip reconciliation failed.");
      setMessage(body?.message || "LockTrip booking state checked.");
      if (body?.resolved) window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LockTrip reconciliation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
      <p className="font-semibold text-zinc-100">Verify current LockTrip booking state</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        Performs one read-only booking-detail lookup for the existing prepared booking. It never retries supplier confirmation or creates another reservation.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void verify()}
        className="mt-3 rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-40"
      >
        {busy ? "Checking once…" : "Check provider state once"}
      </button>
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <p className="mt-3 font-mono text-[10px] text-zinc-700">
        Ledger {ledgerId} · {preparedBookingId}
      </p>
    </div>
  );
}
