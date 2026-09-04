"use client";

import { useState } from "react";

export function CaseActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body?: Record<string, string>) {
    setBusy(true);
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await response.json()) as {
      success?: boolean;
      error?: { message?: string };
    };
    setBusy(false);
    if (!response.ok || json.success === false) {
      setError(json.error?.message || "Request failed");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "pending" || status === "not_started" ? (
          <button
            disabled={busy}
            onClick={() => void post(`/api/admin/verification/${id}/review`)}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 font-mono text-[10px] font-bold text-amber-400"
          >
            Start review
          </button>
        ) : null}
        {status === "in_review" ? (
          <button
            disabled={busy}
            onClick={() => void post(`/api/admin/verification/${id}/approve`)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 font-mono text-[10px] font-bold text-black"
          >
            Approve
          </button>
        ) : null}
        {status === "in_review" || status === "pending" ? (
          <button
            disabled={busy || !reason.trim()}
            onClick={() =>
              void post(`/api/admin/verification/${id}/reject`, { reason })
            }
            className="rounded-lg bg-zinc-800 px-3 py-1.5 font-mono text-[10px] font-bold text-red-300 disabled:opacity-40"
          >
            Reject
          </button>
        ) : null}
        {status === "approved" ? (
          <button
            disabled={busy || !reason.trim()}
            onClick={() =>
              void post(`/api/admin/verification/${id}/revoke`, { reason })
            }
            className="rounded-lg bg-zinc-800 px-3 py-1.5 font-mono text-[10px] font-bold text-red-300 disabled:opacity-40"
          >
            Revoke
          </button>
        ) : null}
      </div>
      {(status === "in_review" || status === "pending" || status === "approved") && (
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason required for reject/revoke"
          className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 font-mono text-[11px] text-zinc-300"
        />
      )}
      {error ? <p className="font-mono text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
