"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type City = { name?: string; country?: string } | null;
type EventData = { id?: string; category?: string | null; venue_name?: string | null; venue_address?: string | null; price?: number | null; currency?: string | null; image_url?: string | null; booking_url?: string | null } | null;
type Appointment = { status?: string | null; payment_status?: string | null; price?: number | null; currency?: string | null; customer_total_amount?: number | null } | null;
type Item = { id: string; item_kind: string; display_title: string; display_start: string | null; display_end: string | null; notes?: string | null; event?: EventData; appointment?: Appointment };
type Trip = { id: string; title: string; start_on: string | null; end_on: string | null; status: string; cities?: City };

function formatWhen(value: string | null) {
  if (!value) return "Time to be scheduled";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function kindLabel(item: Item) {
  if (item.item_kind === "event") return "Experience";
  if (item.item_kind === "appointment") return "Appointment";
  if (item.item_kind === "hotel") return "Stay";
  if (item.item_kind === "transfer") return "Transfer";
  if (item.item_kind === "restaurant") return "Dining";
  return item.item_kind.replaceAll("_", " ");
}

export default function TripItineraryPage({ params }: { params: { tripId: string } }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("Loading your itinerary…");

  useEffect(() => {
    void fetch(`/api/trip-planner/${params.tripId}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "Unable to load this trip."); return; }
      setTrip(body.trip); setItems(body.items || []); setMessage(body.items?.length ? "Your journey is taking shape." : "Your itinerary is empty — add experiences from the planner.");
    }).catch(() => setMessage("Unable to reach SafariPlug."));
  }, [params.tripId]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of items) {
      const key = item.display_start ? new Date(item.display_start).toISOString().slice(0, 10) : "unscheduled";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return [...groups.entries()].sort(([a], [b]) => a === "unscheduled" ? 1 : b === "unscheduled" ? -1 : a.localeCompare(b));
  }, [items]);

  const plannerLink = `/plan?tripId=${encodeURIComponent(params.tripId)}`;
  const conciergeLink = `/concierge?tripId=${encodeURIComponent(params.tripId)}`;
  const servicesLink = `/services?tripId=${encodeURIComponent(params.tripId)}`;

  return <main className="min-h-screen bg-[#0b0b0b] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-5xl">
    <Link href="/plan" className="text-sm text-white/50 hover:text-white">← Back to planner</Link>
    {trip ? <>
      <header className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-7 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">SafariPlug Journey</p>
        <h1 className="mt-3 text-4xl font-semibold md:text-6xl">{trip.title}</h1>
        <p className="mt-3 text-lg text-white/60">{trip.cities?.name || "Destination"}{trip.cities?.country ? `, ${trip.cities.country}` : ""}</p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60"><span className="rounded-full bg-white/10 px-4 py-2">{trip.start_on || "Flexible start"}</span><span className="rounded-full bg-white/10 px-4 py-2">{trip.end_on || "Flexible end"}</span><span className="rounded-full bg-white/10 px-4 py-2 capitalize">{trip.status}</span></div>
      </header>

      <section className="mt-8 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6 md:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Complete the journey</p>
        <h2 className="mt-2 text-2xl font-semibold">Book the pieces around your itinerary</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Use SafariPlug Concierge to coordinate dining, transfers, hotels and other services for this trip, or book a service directly and keep it attached to the journey.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={conciergeLink} className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-black">Ask Concierge</Link>
          <Link href={servicesLink} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black">Book a service</Link>
          <Link href={plannerLink} className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold">Add experience</Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Itinerary</p><h2 className="mt-2 text-2xl font-semibold">Everything in one journey</h2></div><Link href={plannerLink} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">+ Add</Link></div>
        {grouped.length ? <div className="mt-6 space-y-7">{grouped.map(([day, dayItems]) => <div key={day}><p className="mb-3 text-sm font-bold uppercase tracking-widest text-white/45">{day === "unscheduled" ? "To schedule" : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${day}T12:00:00`))}</p><div className="space-y-3">{dayItems.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6"><div className="flex flex-col gap-5 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">{kindLabel(item)}</span>{item.appointment?.payment_status && <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-white/55">{item.appointment.payment_status}</span>}</div><h3 className="mt-3 text-xl font-semibold">{item.display_title}</h3><p className="mt-1 text-sm text-white/55">{formatWhen(item.display_start)}{item.display_end ? ` → ${new Date(item.display_end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</p>{item.event?.venue_name && <p className="mt-2 text-sm text-white/45">{item.event.venue_name}{item.event.venue_address ? ` · ${item.event.venue_address}` : ""}</p>}{item.notes && <p className="mt-3 text-sm text-white/40">{item.notes}</p>}</div><div className="flex shrink-0 flex-wrap gap-2 md:justify-end">{item.event?.booking_url && <a href={item.event.booking_url} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">Book experience</a>}{item.event?.id && !item.event?.booking_url && <Link href={`/events/${item.event.id}?tripId=${encodeURIComponent(params.tripId)}`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">View experience</Link>}{item.item_kind === "appointment" && <Link href={servicesLink} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black">Book another service</Link>}{["hotel", "transfer", "restaurant"].includes(item.item_kind) && <Link href={conciergeLink} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">Arrange with Concierge</Link>}{!item.event?.booking_url && !item.event?.id && item.item_kind !== "appointment" && !["hotel", "transfer", "restaurant"].includes(item.item_kind) && <Link href={conciergeLink} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">Arrange with Concierge</Link>}</div></div></article>)}</div></div>)}</div> : <div className="mt-6 rounded-3xl border border-dashed border-white/15 p-10 text-center"><p className="text-white/60">No itinerary items yet.</p><Link href={plannerLink} className="mt-5 inline-block rounded-full bg-amber-400 px-5 py-3 font-bold text-black">Add your first experience</Link></div>}
      </section>
      <p className="mt-6 text-sm text-white/45">{message}</p>
    </> : <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/60">{message}</div>}
  </div></main>;
}
