"use client";

import { FormEvent, useEffect, useState } from "react";

 type Trip = {
  id: string;
  title: string;
  start_on: string | null;
  end_on: string | null;
  status: string;
  cities?: { name?: string; country?: string } | null;
};

export default function PlanPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [message, setMessage] = useState("Loading your trips…");
  const [saving, setSaving] = useState(false);

  async function loadTrips() {
    const response = await fetch("/api/trip-planner", { cache: "no-store" });
    if (response.status === 401) { setMessage("Sign in to build and save a SafariPlug trip."); return; }
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Unable to load trips."); return; }
    setTrips(body.trips || []);
    setMessage(body.trips?.length ? "Your journeys" : "No journeys yet — start planning below.");
  }

  useEffect(() => { void loadTrips(); }, []);

  async function createTrip(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("Creating your trip…");
    try {
      const response = await fetch("/api/trip-planner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, destination, startOn, endOn }),
      });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "Unable to create trip."); return; }
      setTrips((current) => [body.trip, ...current]);
      setTitle(""); setDestination(""); setStartOn(""); setEndOn("");
      setMessage("Trip created. Next, SafariPlug can help fill the itinerary with hotels, drivers, food and experiences.");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-12 text-white md:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">SafariPlug Intelligence</p>
        <h1 className="mt-3 text-4xl font-semibold md:text-6xl">Plan the whole journey.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-white/65">One trip for your hotel, airport transfer, restaurant, experience, appointment, driver and events. This is the foundation for SafariPlug&apos;s AI travel agent.</p>

        <form onSubmit={createTrip} className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:grid-cols-2">
          <div className="md:col-span-2"><label className="text-sm text-white/60">Trip name</label><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Nairobi long weekend" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
          <div><label className="text-sm text-white/60">Destination</label><input value={destination} onChange={(e)=>setDestination(e.target.value)} placeholder="Nairobi" required className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
          <div><label className="text-sm text-white/60">Start date</label><input type="date" value={startOn} onChange={(e)=>setStartOn(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
          <div><label className="text-sm text-white/60">End date</label><input type="date" value={endOn} onChange={(e)=>setEndOn(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
          <div className="md:col-span-2"><button disabled={saving} className="w-full rounded-2xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50">{saving ? "Building…" : "Create my trip"}</button></div>
        </form>

        <p className="mt-6 text-sm text-white/50">{message}</p>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {trips.map((trip) => <article key={trip.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{trip.title}</h2><p className="mt-1 text-white/55">{trip.cities?.name || "Destination being prepared"}{trip.cities?.country ? `, ${trip.cities.country}` : ""}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-white/65">{trip.status}</span></div><p className="mt-5 text-sm text-white/55">{trip.start_on || "Flexible dates"}{trip.end_on ? ` → ${trip.end_on}` : ""}</p></article>)}
        </section>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[['01','Discover','AI finds the best experiences, restaurants, services and hidden gems.'],['02','Build','Add hotels, transfers, food, appointments and events to one itinerary.'],['03','Book','Confirm availability and pay when real supplier inventory is connected.']].map(([n,t,b]) => <div key={n} className="rounded-3xl border border-white/10 p-5"><p className="text-xs font-bold text-amber-400">{n}</p><h3 className="mt-2 font-semibold">{t}</h3><p className="mt-2 text-sm leading-6 text-white/50">{b}</p></div>)}
        </div>
      </div>
    </main>
  );
}
