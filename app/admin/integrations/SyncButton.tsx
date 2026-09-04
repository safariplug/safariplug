"use client";

import { useState } from "react";
import { runAurelianSync, type SyncActionState } from "./actions";

export default function SyncButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncActionState | null>(null);

  async function onClick() {
    setPending(true);
    try {
      const next = await runAurelianSync();
      setResult(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className="rounded-xl bg-amber-500 px-4 py-2.5 font-mono text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? "Recording inventory…" : "Record approved inventory"}
      </button>
      {result ? (
        <p
          className={`font-mono text-xs leading-6 ${
            result.ok ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
