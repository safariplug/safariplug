"use client";

import { useState } from "react";

export default function ReconciliationActions({ ledgerId, reference }: { ledgerId: string; reference: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"verify" | "not-confirmed" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function act(action: "verify_reference" | "mark_not_confirmed") {
    setBusy(action === "verify_reference" ? "verify" : "not-confirmed");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/activities-reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ledgerId,
          confirmationText: confirmation.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Reconciliation action failed.");
      setMessage(body?.message || "Reconciliation updated.");
      if (body?.resolved === true) window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <p className="font-semibold text-zinc-100">Verify existing supplier reference</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          This performs one Hotelbeds booking-detail request for {reference || "the stored reference"}. It does not call RECONFIRM or create a booking.
        </p>
        <button type="button" disabled={busy !== null || !reference} onClick={() => void act("verify_reference")} className="mt-3 rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300 disabled:opacity-40">
          {busy === "verify" ? "Checking supplier…" : "Check supplier status once"}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <p className="font-semibold text-zinc-100">Record not confirmed</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Use only after staff have verified the activity was not finally confirmed. The paid transaction is retained and flagged for manual refund review.
        </p>
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder='Type NOT CONFIRMED' className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        <button type="button" disabled={busy !== null || confirmation !== "NOT CONFIRMED"} onClick={() => void act("mark_not_confirmed")} className="mt-3 rounded-xl border border-red-800 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-40">
          {busy === "not-confirmed" ? "Recording…" : "Record not confirmed"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-300 lg:col-span-2">{message}</p> : null}
      {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
    </div>
  );
}
