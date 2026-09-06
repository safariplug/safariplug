"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTripButton({ empty = false }: { empty?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createTrip(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, startOn: startOn || null, endOn: endOn || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/account/trips")}`;
        return;
      }
      if (!response.ok) throw new Error(body.error || "Could not create your journey.");
      router.push(`/account/trips/${body.trip.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your journey.");
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={empty ? "mt-6 inline-flex rounded-full bg-white px-6 py-3 font-bold text-black" : "rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-400"}>
        {empty ? "Create a journey" : "＋ New Trip"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-trip-title">
          <form onSubmit={createTrip} className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Plan your journey</p>
                <h2 id="new-trip-title" className="mt-2 text-3xl font-black">Start a new trip</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-zinc-500 hover:text-white" aria-label="Close">×</button>
            </div>

            <label className="mt-7 block text-sm font-semibold text-zinc-300">
              Trip name
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Kenya getaway" className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-amber-400" />
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-zinc-300">
                Start date
                <input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-amber-400" />
              </label>
              <label className="block text-sm font-semibold text-zinc-300">
                End date
                <input type="date" min={startOn || undefined} value={endOn} onChange={(e) => setEndOn(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-amber-400" />
              </label>
            </div>

            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <div className="mt-7 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300">Cancel</button>
              <button type="submit" disabled={loading} className="rounded-full bg-amber-500 px-6 py-3 text-sm font-black text-black disabled:opacity-60">{loading ? "Creating…" : "Create journey"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
