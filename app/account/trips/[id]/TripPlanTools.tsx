"use client";

import Link from "next/link";
import { useState } from "react";

export default function TripPlanTools({ tripId }: { tripId: string }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function renameTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not update the journey.");
      setTitle("");
      setMessage("Journey name updated.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the journey.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 border-t border-zinc-800 pt-6">
      <div className="flex flex-wrap gap-3">
        <Link href="/events" className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-black hover:bg-amber-400">＋ Add experiences</Link>
        <Link href="/account/saved" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">Browse saved</Link>
      </div>
      <form onSubmit={renameTrip} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Rename this journey" aria-label="New journey name" className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-black px-5 py-3 text-sm text-white outline-none focus:border-amber-500" />
        <button type="submit" disabled={saving || !title.trim()} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 disabled:opacity-40">{saving ? "Saving…" : "Rename"}</button>
      </form>
      {message && <p className="mt-2 text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
