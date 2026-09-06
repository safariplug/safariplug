"use client";

import { useState } from "react";

export default function PayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Request failed");
    return result;
  }

  async function act(action: "approve" | "hold" | "execute") {
    if (action === "execute" && !window.confirm("Send this approved provider payout through M-Pesa now?")) return;
    const reason = action === "hold" ? window.prompt("Reason for holding this payout?") : null;
    if (action === "hold" && !reason?.trim()) return;
    setBusy(true); setMessage("");
    try {
      if (action === "execute") {
        await post("/api/admin/payouts/execute", { payoutId });
        setMessage("M-Pesa request submitted");
      } else {
        await post("/api/admin/payouts", { action, payoutId, reason });
        setMessage(action === "approve" ? "Approved" : "Held");
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "eligible") return <div className="flex gap-2"><button disabled={busy} onClick={() => act("approve")} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => act("hold")} className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50">Hold</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  if (status === "approved") return <div className="flex gap-2"><button disabled={busy} onClick={() => act("execute")} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Send M-Pesa</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  if (status === "processing") return <span className="text-xs text-white/45">Awaiting M-Pesa result</span>;
  return <span className="text-xs text-white/35">—</span>;
}
