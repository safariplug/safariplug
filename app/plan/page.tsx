"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Trip = { id: string; title: string; start_on: string | null; end_on: string | null; status: string; cities?: { name?: string; country?: string } | null };
type EventItem = { id: string; title: string; category?: string | null; start_at?: string | null; venue_name?: string | null };

export default function PlanPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [title, setTitle] = useState(""); const [destination, setDestination] = useState(""); const [startOn, setStartOn] = useState(""); const [endOn, setEndOn] = useState("");
  const [ideas, setIdeas] = useState<EventItem[]>([]); const [selectedTrip, setSelectedTrip] = useState(""); const [message, setMessage] = useState("Loading your trips…"); const [saving, setSaving] = useState(false);

  async function loadTrips() {
    const response = await fetch("/api/trip-planner", { cache: "no-store" });
    if (response.status === 401) { setMessage("Sign in to build and save a SafariPlug trip."); return; }
    const body = await response.json(); if (!response.ok) { setMessage(body.error || "Unable to load trips."); return; }
    setTrips(body.trips || []); setSelectedTrip(body.trips?.[0]?.id || ""); setMessage(body.trips?.length ? "Your journeys" : "No journeys yet — start planning below.");
  }
  useEffect(() => { void loadTrips(); }, []);

  async function createTrip(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("Creating your trip…");
    try { const response = await fetch("/api/trip-planner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, destination, startOn, endOn }) }); const body = await response.json(); if (!response.ok) { setMessage(body.error || "Unable to create trip."); return; } setTrips((current) => [body.trip, ...current]); setSelectedTrip(body.trip.id); setTitle(""); setDestination(""); setStartOn(""); setEndOn(""); setMessage("Trip created. Now add real SafariPlug discoveries to the journey."); } finally { setSaving(false); }
  }

  async function findIdeas() {
    setMessage("Finding live SafariPlug discoveries…"); const params = new URLSearchParams({ limit: "8" }); if (destination) params.set("q", destination);
    try { const response = await fetch(`/api/v1/events?${params.toString()}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) { setMessage(body.error?.message || "Unable to find discoveries."); return; } setIdeas(Array.isArray(body.data) ? body.data : []); setMessage(body.data?.length ? `${body.data.length} live discoveries found.` : "No matching live discoveries yet."); } catch { setMessage("Unable to reach SafariPlug discoveries."); }
  }

  async function addIdea(eventId: string) {
    if (!selectedTrip) { setMessage("Create or select a trip first."); return; }
    const response = await fetch(`/api/v1/trips/${selectedTrip}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event_id: eventId }) });
    const body = await response.json(); if (!response.ok) { setMessage(body.error?.message || "Could not add that discovery."); return; } setMessage("Added to your journey. Open the itinerary to see it scheduled.");
  }

  return <main className="min-h-screen bg-[#0b0b0b] px-5 py-12 text-white md:px-10"><div className="mx-auto max-w-5xl">
    <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">SafariPlug Intelligence</p><h1 className="mt-3 text-4xl font-semibold md:text-6xl">Plan the whole journey.</h1>
    <p className="mt-4 max-w-2xl text-lg leading-8 text-white/65">One trip for your hotel, airport transfer, restaurant, experience, appointment, driver and events. Start with a destination and let SafariPlug build the journey around you.</p>
    <form onSubmit={createTrip} className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:grid-cols-2">
      <div className="md:col-span-2"><label className="text-sm text-white/60">Trip name</label><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Nairobi long weekend" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
      <div><label className="text-sm text-white/60">Destination</label><input value={destination} onChange={(e)=>setDestination(e.target.value)} placeholder="Nairobi" required className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
      <div><label className="text-sm text-white/60">Start date</label><input type="date" value={startOn} onChange={(e)=>setStartOn(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
      <div><label className="text-sm text-white/60">End date</label><input type="date" value={endOn} onChange={(e)=>setEndOn(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400" /></div>
      <div className="md:col-span-2"><button disabled={saving} className="w-full rounded-2xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50">{saving ? "Building…" : "Create my trip"}</button></div>
    </form>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex flex-col gap-4 md:flex-row md:items-end"><div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">AI discovery</p><h2 className="mt-2 text-2xl font-semibold">Fill your journey</h2><p className="mt-2 text-sm text-white/50">Search approved SafariPlug discoveries and add them directly to a trip.</p></div><button type="button" onClick={() => void findIdeas()} className="rounded-2xl border border-amber-400/40 px-5 py-3 font-bold text-amber-300">Find experiences</button></div>
      {trips.length > 0 && <select value={selectedTrip} onChange={(e)=>setSelectedTrip(e.target.value)} className="mt-5 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><option value="">Select a trip</option>{trips.map((trip)=><option key={trip.id} value={trip.id}>{trip.title}</option>)}</select>}
      {ideas.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2">{ideas.map((item)=><article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-amber-400">{item.category || "Experience"}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-white/45">{item.venue_name || "SafariPlug discovery"}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-white/40">{item.start_at ? new Date(item.start_at).toLocaleDateString() : "Flexible"}</span><button type="button" onClick={() => void addIdea(item.id)} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black">Add to trip</button></div></article>)}</div>}
    </section>
    <p className="mt-6 text-sm text-white/50">{message}</p>
    <section className="mt-6 grid gap-4 md:grid-cols-2">{trips.map((trip)=><article key={trip.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{trip.title}</h2><p className="mt-1 text-white/55">{trip.cities?.name || "Destination being prepared"}{trip.cities?.country ? `, ${trip.cities.country}` : ""}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-white/65">{trip.status}</span></div><p className="mt-5 text-sm text-white/55">{trip.start_on || "Flexible dates"}{trip.end_on ? ` → ${trip.end_on}` : ""}</p><Link href={`/plan/${trip.id}`} className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-black">Open itinerary →</Link></article>)}</section>
  </div></main>;
}
