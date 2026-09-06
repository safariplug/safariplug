"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; title: string | null };

export default function TripReorder({ tripId, items }: { tripId: string; items: Item[] }) {
  const router = useRouter();
  const [ordered, setOrdered] = useState(items);
  const [saving, setSaving] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdered(next);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/trips/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripId, itemIds: ordered.map((item) => item.id) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        window.alert(body.error || "Could not save your itinerary order.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (ordered.length < 2) return null;

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-black/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Arrange your journey</h2>
          <p className="mt-1 text-xs text-zinc-500">Move experiences into the order you want.</p>
        </div>
        <button type="button" onClick={save} disabled={saving} className="rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-black disabled:opacity-60">
          {saving ? "Saving…" : "Save order"}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {ordered.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 px-3 py-2">
            <span className="w-6 text-center text-xs font-bold text-zinc-500">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title || "Experience"}</span>
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 disabled:opacity-20">↑</button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === ordered.length - 1} aria-label="Move down" className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 disabled:opacity-20">↓</button>
          </div>
        ))}
      </div>
    </section>
  );
}
