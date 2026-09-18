"use client";

import { useState } from "react";

export default function ReconciliationActions({
  ledgerId,
  preparedBookingId,
  storedReference,
}: {
  ledgerId: string;
  preparedBookingId: string;
  storedReference: string;
}) {
  const [reference, setReference] = useState(storedReference);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"verify" | "no-booking" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function act(action: "verify_reference" | "mark_not_booked") {
    setBusy(action === "verify_reference" ? "verify" : "no-booking");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/hotels-reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ledgerId,
          reference: reference.trim(),
          confirmationText: confirmation.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Reconciliation action failed.");
      setMessage(body?.message || "Reconciliation updated.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <p className="font-semibold text-zinc-100">Verify an existing Hotelbeds booking</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Enter a supplier booking reference only when there is evidence that a booking may exist.
          This performs one explicit booking-detail lookup. It never creates or retries a hotel booking.
        </p>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Hotelbeds booking reference"
          className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy !== null || !reference.trim()}
          onClick={() => void act("verify_reference")}
          className="mt-3 rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-40"
        >
          {busy === "verify" ? "Verifying once…" : "Verify reference once"}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <p className="font-semibold text-zinc-100">Record no supplier booking</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Use only after staff have independently verified that no Hotelbeds booking exists.
          Customer payment remains paid and is flagged for manual refund review.
        </p>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder='Type NO SUPPLIER BOOKING'
          className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy !== null || confirmation !== "NO SUPPLIER BOOKING"}
          onClick={() => void act("mark_not_booked")}
          className="mt-3 rounded-xl border border-red-800 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-40"
        >
          {busy === "no-booking" ? "Recording…" : "Record no booking"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-300 lg:col-span-2">{message}</p> : null}
      {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
      <p className="font-mono text-[10px] text-zinc-700 lg:col-span-2">
        Ledger {ledgerId} · {preparedBookingId}
      </p>
    </div>
  );
}
