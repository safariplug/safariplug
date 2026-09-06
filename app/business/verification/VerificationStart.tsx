"use client";

import { useState } from "react";

export default function VerificationStart({ hasCase, status }: { hasCase: boolean; status: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/business/verification", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to start verification.");
      setMessage("Verification case ready. SafariPlug will keep it blocked until the required identity and live-liveness provider is connected.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start verification.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">Your provider verification is approved. Payout execution remains subject to current payout destination and compliance checks.</div>;
  }

  return <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"><button disabled={busy || (hasCase && status === "in_review")} onClick={() => void start()} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-35">{busy ? "Preparing…" : hasCase ? "Verification case active" : "Start provider verification"}</button>{message ? <p className="max-w-xl text-xs leading-5 text-black/50">{message}</p> : null}</div>;
}
