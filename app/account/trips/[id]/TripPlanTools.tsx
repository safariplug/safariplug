"use client";

import Link from "next/link";
import { useState } from "react";

export default function TripPlanTools({ tripId }: { tripId: string }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  async function renameTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/trips/${tripId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title.trim() }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not update the journey.");
      setTitle(""); setMessage("Journey name updated."); window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the journey."); } finally { setSaving(false); }
  }

  async function shareTrip() {
    setSharing(true); setMessage("");
    try {
      const response = await fetch("/api/trips/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.shareUrl) throw new Error(body.error || "Could not create a share link.");
      const absolute = `${window.location.origin}${body.shareUrl}`;
      setShareUrl(absolute);
      try { await navigator.clipboard.writeText(absolute); setMessage("Share link copied to your clipboard."); } catch { setMessage("Share link ready below."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create a share link."); } finally { setSharing(false); }
  }

  return <div className="mt-8 border-t border-zinc-800 pt-6"><div className="flex flex-wrap gap-3"><Link href={`/events?tripId=${encodeURIComponent(tripId)}`} className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-black hover:bg-amber-400">＋ Add experiences</Link><Link href={`/concierge?tripId=${encodeURIComponent(tripId)}`} className="rounded-full border border-amber-500/50 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10">✦ Plan with Concierge</Link><Link href={`/account/saved?tripId=${encodeURIComponent(tripId)}`} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">Browse saved</Link><Link href="/services" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">Book a service</Link><Link href="/account/appointments" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">My bookings</Link><a href={`/api/trips/${encodeURIComponent(tripId)}/calendar`} download className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">＋ Add to calendar</a><button type="button" onClick={shareTrip} disabled={sharing} className="rounded-full border border-amber-500/50 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">{sharing ? "Creating link…" : "↗ Share journey"}</button><button type="button" onClick={() => window.print()} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white hover:border-amber-500/50 hover:text-amber-300">⎙ Print itinerary</button></div>{shareUrl && <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Shareable itinerary</p><p className="mt-2 break-all text-sm text-zinc-300">{shareUrl}</p><Link href={shareUrl.replace(window.location.origin, "")} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300">Open shared itinerary →</Link></div>}<form onSubmit={renameTrip} className="mt-6 flex flex-col gap-2 sm:flex-row"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Rename this journey" aria-label="New journey name" className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-black px-5 py-3 text-sm text-white outline-none focus:border-amber-500" /><button type="submit" disabled={saving || !title.trim()} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 disabled:opacity-40">{saving ? "Saving…" : "Rename"}</button></form>{message && <p className="mt-2 text-xs text-zinc-400">{message}</p>}</div>;
}
