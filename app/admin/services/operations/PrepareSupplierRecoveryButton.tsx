"use client";

import { useState } from "react";

export default function PrepareSupplierRecoveryButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cron/supplier-quality-recovery", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to prepare recovery tasks.");
      setMessage(
        `Recovery queue updated: ${body.created || 0} created, ${body.updated || 0} refreshed, ${body.closed || 0} resolved.`,
      );
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare recovery tasks.");
      setBusy(false);
    }
  }

  return <div className="flex flex-col items-end gap-2">
    <button
      onClick={() => void run()}
      disabled={busy}
      className="rounded-xl border border-amber-700/50 px-4 py-2 text-xs font-semibold text-amber-300 disabled:opacity-50"
    >
      {busy ? "Preparing…" : "Prepare recovery tasks"}
    </button>
    {message ? <p className="max-w-xs text-right text-[11px] text-zinc-500">{message}</p> : null}
  </div>;
}
