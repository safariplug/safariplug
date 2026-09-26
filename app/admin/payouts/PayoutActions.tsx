"use client";

import { useState } from "react";

export default function PayoutActions({ payoutId, status, canManageFinance }: { payoutId: string; status: string; canManageFinance: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Request failed");
    return result;
  }

  async function act(action: "approve" | "hold" | "execute" | "reconcile_paid" | "reconcile_failed" | "sweep_stale") {
    if (action === "execute" && !window.confirm("Send this approved provider payout through M-Pesa now?")) return;
    if (action === "sweep_stale" && !window.confirm("Move payouts stuck in processing for more than 24 hours into held reconciliation?")) return;
    const reason = action === "hold" ? window.prompt("Reason for holding this payout?") : null;
    if (action === "hold" && !reason?.trim()) return;
    const notes = action === "reconcile_paid" || action === "reconcile_failed" ? window.prompt("Finance reconciliation notes (required)") : null;
    if ((action === "reconcile_paid" || action === "reconcile_failed") && !notes?.trim()) return;
    const reference = action === "reconcile_paid" ? window.prompt("M-Pesa transaction / payout reference (required)") : null;
    if (action === "reconcile_paid" && !reference?.trim()) return;
    setBusy(true); setMessage("");
    try {
      if (action === "execute") {
        await post("/api/admin/payouts/execute", { payoutId });
        setMessage("M-Pesa request submitted");
      } else if (action === "sweep_stale") {
        const result = await post("/api/admin/payouts", { action });
        setMessage(`${result.movedToHeld || 0} stale payout(s) moved to reconciliation`);
      } else if (action === "reconcile_paid" || action === "reconcile_failed") {
        await post("/api/admin/payouts", { action, payoutId, notes, reference });
        setMessage(action === "reconcile_paid" ? "Reconciled as paid" : "Reconciled as failed");
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

  if (!canManageFinance && ["eligible","approved"].includes(status)) return <span className="text-xs text-amber-300">Finance role required</span>;
  if (status === "eligible") return <div className="flex gap-2"><button disabled={busy} onClick={() => act("approve")} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => act("hold")} className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50">Hold</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  if (status === "approved") return <div className="flex gap-2"><button disabled={busy} onClick={() => act("execute")} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">Send M-Pesa</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  if (status === "processing") return <div className="flex flex-wrap gap-2"><span className="self-center text-xs text-white/45">Awaiting M-Pesa result</span><button disabled={busy} onClick={() => act("reconcile_paid")} className="rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 disabled:opacity-50">Confirm paid</button><button disabled={busy} onClick={() => act("reconcile_failed")} className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50">Confirm failed</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  if (status === "held" || status === "failed") return <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => act("reconcile_paid")} className="rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 disabled:opacity-50">Confirm paid</button><button disabled={busy} onClick={() => act("reconcile_failed")} className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50">Confirm failed</button>{message && <span className="self-center text-xs text-white/45">{message}</span>}</div>;
  return <span className="text-xs text-white/35">—</span>;
}
