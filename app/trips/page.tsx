"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Trip = {
  id: string;
  title: string | null;
  destination_city_id: string | null;
  start_on: string | null;
  end_on: string | null;
  status: string;
  created_at: string;
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadTrips() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/trips?limit=50", { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError("Sign in to see your trips.");
        return;
      }
      if (!response.ok) throw new Error(body?.error?.message || body?.error || "Unable to load trips.");
      setTrips(Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trips.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTrips(); }, []);

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/v1/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: String(form.get("title") || "").trim() || undefined,
          start_on: String(form.get("start_on") || "") || undefined,
          end_on: String(form.get("end_on") || "") || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || body?.error || "Unable to create trip.");
      event.currentTarget.reset();
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create trip.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#111] text-white">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:px-10">
          <Link href="/account" className="text-xs font-semibold uppercase tracking-[.18em] text-white/45 hover:text-white">← My SafariPlug</Link>
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[.28em] text-white/40">My trips</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-[-.045em] sm:text-6xl">Build the journey.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/60">Keep stays, experiences, events, restaurants and service appointments organized around the trip you are actually taking.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <form onSubmit={createTrip} className="h-fit rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">New trip</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start an itinerary</h2>
            <div className="mt-6 space-y-3">
              <input name="title" placeholder="Trip name, e.g. Nairobi weekend" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30" />
              <div className="grid grid-cols-2 gap-3">
                <input name="start_on" type="date" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm" />
                <input name="end_on" type="date" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm" />
              </div>
              <button disabled={creating} className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : "Create trip"}</button>
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </form>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Your itineraries</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{trips.length ? `${trips.length} trip${trips.length === 1 ? "" : "s"}` : "Nothing planned yet"}</h2></div>
              <Link href="/concierge" className="hidden rounded-full bg-black px-4 py-2 text-xs font-semibold text-white sm:inline-flex">Plan with Concierge</Link>
            </div>

            {loading ? <div className="mt-6 rounded-[1.75rem] border border-black/8 bg-white p-10 text-sm text-black/45">Loading your trips…</div> : trips.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{trips.map((trip) => <Link key={trip.id} href={`/account/trips/${trip.id}`} className="group rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">{trip.status || "draft"}</p><h3 className="mt-2 text-xl font-semibold">{trip.title || "Untitled trip"}</h3></div><span className="text-black/35 transition group-hover:translate-x-1">↗</span></div><p className="mt-4 text-sm text-black/50">{trip.start_on || "Date not set"}{trip.end_on ? ` — ${trip.end_on}` : ""}</p></Link>)}</div> : <div className="mt-6 rounded-[1.75rem] border border-dashed border-black/15 bg-white px-6 py-16 text-center"><p className="text-lg font-semibold">Your next trip starts here.</p><p className="mt-2 text-sm text-black/50">Create an itinerary, then add experiences and bookings as you discover them.</p><Link href="/events" className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Start discovering</Link></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
