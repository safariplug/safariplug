"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayoutReviewControls({
  providerUserId,
  status,
}: {
  providerUserId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function submit(action: "verify" | "reject") {
    setBusy(action);
    setMessage("");
    const response = await fetch("/api/admin/payout-destinations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerUserId,
        action,
        reason: action === "reject" ? reason.trim() : undefined,
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy("");
    if (!response.ok) {
      setMessage(body?.error || "Unable to update payout destination.");
      return;
    }
    setMessage(action === "verify" ? "Payout destination verified." : "Payout destination rejected.");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payout destination review</p>
      <p className="mt-1 text-sm text-zinc-300">Current status: <strong className="capitalize">{status || "not set up"}</strong></p>
      {status && status !== "verified" ? (
        <>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Rejection reason (required only when rejecting)"
            rows={2}
            maxLength={500}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void submit("verify")}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              {busy === "verify" ? "Verifying…" : "Verify payout destination"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !reason.trim()}
              onClick={() => void submit("reject")}
              className="rounded-lg border border-red-800 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40"
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </>
      ) : null}
      {message ? <p className="mt-3 text-xs text-zinc-400">{message}</p> : null}
    </div>
  );
}
