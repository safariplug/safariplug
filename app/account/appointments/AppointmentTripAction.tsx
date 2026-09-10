"use client";

import { useEffect, useState } from "react";

export default function AppointmentTripAction({ appointmentId, currentTripId }: { appointmentId: string; currentTripId?: string | null }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [tripId, setTripId] = useState(currentTripId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/trips", { cache: "no-store" })
      .then(async r => r.ok ? r.json() : { trips: [] })
      .then(j => setTrips(j.trips ?? []))
      .catch(() => setTrips([]));
  }, []);

  async function add() {
    if (!tripId) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/account/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add_to_trip", appointmentId, tripId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to add appointment.");
      setMessage(j.added === false ? "Already in this journey." : "Added to your journey.");
      setTripId(j.trip?.id ?? tripId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to add appointment.");
    } finally {
      setBusy(false);
    }
  }

  if (currentTripId) {
    return <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-semibold">Added to your journey</p><a href={`/account/trips/${currentTripId}`} className="mt-1 inline-block font-semibold underline underline-offset-2">View this journey →</a></div>;
  }

  return <div className="mt-5 rounded-2xl bg-[#f7f7f4] p-4"><p className="text-xs font-semibold">Add to a journey</p>{trips.length ? <div className="mt-3 flex gap-2"><select value={tripId} onChange={e => setTripId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-3 text-sm"><option value="">Choose a journey…</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title || "My SafariPlug Journey"}</option>)}</select><button type="button" disabled={!tripId || busy} onClick={add} className="rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Adding…" : "Add"}</button></div> : <a href="/account/trips" className="mt-3 inline-flex rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white">Create a journey</a>}{message && <p className="mt-2 text-xs text-black/50">{message}</p>}</div>;
}
