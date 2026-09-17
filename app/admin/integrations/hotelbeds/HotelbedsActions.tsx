"use client";

import { useState } from "react";

type Result = Record<string, unknown>;
type Action = "certification_plan" | "health" | "content_sample" | "sync_one_page";

export default function HotelbedsActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run(action: Action) {
    setBusy(action);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/integrations/hotelbeds/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Hotelbeds verification failed.");
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hotelbeds verification failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button disabled={Boolean(busy)} onClick={() => void run("certification_plan")} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
          {busy === "certification_plan" ? "Inspecting…" : "Inspect certification plan"}
        </button>
        <button disabled={Boolean(busy)} onClick={() => void run("health")} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
          {busy === "health" ? "Checking…" : "Verify API health"}
        </button>
        <button disabled={Boolean(busy)} onClick={() => void run("content_sample")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy === "content_sample" ? "Checking…" : "Test 1 content record"}
        </button>
        <button disabled={Boolean(busy)} onClick={() => void run("sync_one_page")} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy === "sync_one_page" ? "Syncing…" : "Sync one page"}
        </button>
      </div>
      <p className="text-xs leading-5 text-zinc-500">The certification plan is read-only. Payment, supplier booking and actual cancellation remain explicit manual actions; SafariPlug will not trigger them from this screen.</p>
      {error ? <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">{error}</div> : null}
      {result ? <pre className="max-h-96 overflow-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-5 text-zinc-300">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}
