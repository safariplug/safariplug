"use client";

import { useState } from "react";

export default function PayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function act(action: "approve" | "hold") {
    const reason = action === "hold" ? window.prompt("Reason for holding this payout?") : null;
    if (action === "hold" && !reason?.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payoutId, reason }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Request failed");
      setMessage(action === "approve" ? "Approved" : "Held");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }

  if (status !== "eligible") return <span className="text-xs text-white/35">—</span>;
  return <div className="flex gap-2"><button disabled={busy} onClick={() => act("approve")} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => act("hold")} className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50">Hold</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
}
