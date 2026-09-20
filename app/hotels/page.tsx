"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

type SupplierContext = {
  search_key?: string;
  region_id?: string;
  star_rating?: number | null;
  address?: string | null;
  images?: string[];
  review_score?: number | null;
  review_count?: number | null;
  board_type?: string | null;
  meal_types?: string[];
  board_name?: string;
  booking_token?: string;
  notices?: string[];
};
type Hotel = { provider: string; property_id: string; property_name: string; room_id: string | null; rate_id: string | null; currency: string; total: { amount: number; currency: string } | null; cancellation: string | null; availability: "available" | "unavailable" | "unknown"; supplier_context?: SupplierContext };
function isoDate(offset: number) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
function nights(a: string, b: string) { return Math.max(1, Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)); }

export default function HotelsPage() {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState(isoDate(7));
  const [checkOut, setCheckOut] = useState(isoDate(9));
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState("1");
  const [results, setResults] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [checkingHotelId, setCheckingHotelId] = useState<string | null>(null);
  const [unavailableHotelIds, setUnavailableHotelIds] = useState<Record<string, string>>({});
  const canSearch = useMemo(() => destination.trim() && checkIn && checkOut && checkOut > checkIn, [destination, checkIn, checkOut]);

  async function search(event: FormEvent) {
    event.preventDefault(); if (!canSearch) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const params = new URLSearchParams({ destination: destination.trim(), check_in: checkIn, check_out: checkOut, guests, rooms, currency: "KES" });
      const response = await fetch(`/api/v1/hotels?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || body?.message || "Hotel inventory is temporarily unavailable.");
      setResults(Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []);
      setUnavailableHotelIds({});
    } catch (err) { setResults([]); setError(err instanceof Error ? err.message : "Hotel search failed."); }
    finally { setLoading(false); }
  }

  async function selectLockTripHotel(hotel: Hotel, ctx: SupplierContext) {
    if (!ctx.search_key || !ctx.region_id || rooms !== "1") return;
    setCheckingHotelId(hotel.property_id);
    setUnavailableHotelIds(current => { const next = { ...current }; delete next[hotel.property_id]; return next; });
    try {
      const response = await fetch("/api/v1/hotels/locktrip/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "rooms",
          hotelId: hotel.property_id,
          searchKey: ctx.search_key,
          regionId: ctx.region_id,
          checkIn,
          checkOut,
          rooms: [{ adults: Math.max(1, Number(guests) || 1), childrenAges: [] }],
          currency: "KES",
        }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "Unable to verify rooms for this stay.");
      const packages = Array.isArray(body?.data?.packages) ? body.data.packages : [];
      if (!packages.length) {
        setUnavailableHotelIds(current => ({ ...current, [hotel.property_id]: "This stay has no bookable room for these dates right now. Choose another live option." }));
        return;
      }
      const activeSearchKey = String(body?.searchKey || body?.data?.searchKey || ctx.search_key);
      const cacheKey = "safariplug:hotel-room-preflight:" + hotel.property_id + ":" + checkIn + ":" + checkOut + ":" + guests;
      window.sessionStorage.setItem(cacheKey, JSON.stringify({ createdAt: Date.now(), hotelId: hotel.property_id, checkIn, checkOut, guests, searchKey: activeSearchKey, packages }));
      const params = new URLSearchParams({ hotelId: hotel.property_id, hotelName: hotel.property_name, searchKey: activeSearchKey, regionId: ctx.region_id, checkIn, checkOut, guests, currency: "KES" });
      window.location.href = "/hotels/book?" + params.toString();
    } catch (err) {
      setUnavailableHotelIds(current => ({ ...current, [hotel.property_id]: err instanceof Error ? err.message : "Unable to verify rooms for this stay." }));
    } finally {
      setCheckingHotelId(null);
    }
  }

  const stayNights = nights(checkIn, checkOut);
  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="relative overflow-hidden bg-[#111] text-white"><div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16"><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug / Stays</p><h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">Stay somewhere worth the trip.<br /><span className="text-white/40">Search real supplier inventory.</span></h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Hotels, lodges and accommodation become part of the same SafariPlug journey as your drivers, services and experiences. Customer prices already include SafariPlug&apos;s booking margin.</p></div></section>
    <DiscoverySwitcher current="/hotels" />
    <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10">
      <form onSubmit={search} className="rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_-50px_rgba(0,0,0,.5)] sm:p-7"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><label className="lg:col-span-2"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.16em] text-black/40">Destination</span><input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Nairobi, Diani, Zanzibar, Kigali..." className="w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3.5 outline-none focus:border-black/30" /></label><label><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.16em] text-black/40">Check in</span><input type="date" value={checkIn} min={isoDate(0)} onChange={e => setCheckIn(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3.5 outline-none" /></label><label><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.16em] text-black/40">Check out</span><input type="date" value={checkOut} min={checkIn || isoDate(1)} onChange={e => setCheckOut(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3.5 outline-none" /></label><label><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.16em] text-black/40">Guests / rooms</span><div className="flex gap-2"><input aria-label="Guests" min="1" type="number" value={guests} onChange={e => setGuests(e.target.value)} className="w-1/2 rounded-2xl border border-black/10 bg-[#fafaf8] px-3 py-3.5 outline-none" /><input aria-label="Rooms" min="1" type="number" value={rooms} onChange={e => setRooms(e.target.value)} className="w-1/2 rounded-2xl border border-black/10 bg-[#fafaf8] px-3 py-3.5 outline-none" /></div></label></div><div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={!canSearch || loading} className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Checking suppliers…" : "Search live stays"}</button><span className="text-xs text-black/40">{stayNights} night{stayNights === 1 ? "" : "s"} · {guests} guest{guests === "1" ? "" : "s"} · {rooms} room{rooms === "1" ? "" : "s"}</span></div></form>
      {error && <div className="mt-7 rounded-[1.5rem] border border-amber-900/15 bg-[#f1eadc] p-6"><p className="font-semibold">Live stay inventory isn&apos;t available for this search.</p><p className="mt-2 text-sm leading-6 text-black/55">{error}</p></div>}
      <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Live results</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{loading ? "Checking availability…" : results.length ? `${results.length} stay option${results.length === 1 ? "" : "s"}` : searched && !error ? "No supplier results returned" : "Ready when you are"}</h2></div>{results.length > 0 && <span className="text-xs text-black/40">{destination} · {checkIn} → {checkOut}</span>}</div>
      {!results.length && !loading && !error && <div className="mt-6 rounded-[2rem] border border-dashed border-black/15 bg-white px-6 py-16 text-center"><p className="text-lg font-semibold">{searched ? "No live rooms matched that search." : "Search any destination."}</p><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/50">SafariPlug only shows live supplier inventory; no placeholder hotel rates.</p></div>}
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{results.map(hotel => {
        const ctx = hotel.supplier_context || {};
        const singleRoom = rooms === "1";
        const lockTripReady = hotel.provider === "locktrip" && singleRoom && Boolean(ctx.search_key && ctx.region_id);
        const hotelbedsReady = hotel.provider === "hotelbeds" && singleRoom && Boolean(ctx.booking_token);
        const hotelbedsParams = new URLSearchParams({ provider: "hotelbeds", hotelName: hotel.property_name, bookingToken: ctx.booking_token || "", checkIn, checkOut, guests, currency: "KES", total: String(hotel.total?.amount || "") });
        return <article key={`${hotel.provider}-${hotel.property_id}`} className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(0,0,0,.45)]">
          {ctx.images?.[0] ? <img src={ctx.images[0]} alt="" className="aspect-[16/9] w-full rounded-[1.25rem] object-cover" /> : <div className="aspect-[16/9] rounded-[1.25rem] bg-gradient-to-br from-[#e7e2d7] via-[#d4cec0] to-[#aaa394]" />}
          <div className="pt-5"><div className="flex items-start justify-between gap-3"><h3 className="text-xl font-semibold tracking-tight">{hotel.property_name}</h3><span className="rounded-full bg-black/[.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">Live availability</span></div>{ctx.address && <p className="mt-2 text-sm text-black/50">{ctx.address}</p>}{hotel.total ? <div className="mt-5 rounded-2xl bg-black/[.035] p-4"><p className="text-[10px] uppercase tracking-[.14em] text-black/40">SafariPlug customer total · {stayNights} night{stayNights === 1 ? "" : "s"}</p><p className="mt-1 text-2xl font-semibold">{hotel.total.currency} {hotel.total.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div> : null}{hotel.cancellation && <p className="mt-4 text-sm leading-6 text-black/55">{hotel.cancellation}</p>}{ctx.notices?.length ? <p className="mt-2 text-xs leading-5 text-black/45">{ctx.notices.join(" · ")}</p> : null}
            {lockTripReady ? <><button type="button" onClick={() => void selectLockTripHotel(hotel, ctx)} disabled={checkingHotelId === hotel.property_id} className="mt-5 flex w-full justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{checkingHotelId === hotel.property_id ? "Checking live rooms…" : "Select room & continue →"}</button>{unavailableHotelIds[hotel.property_id] ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{unavailableHotelIds[hotel.property_id]}</p> : null}</> : hotelbedsReady ? <Link href={`/hotels/hotelbeds-book?${hotelbedsParams.toString()}`} className="mt-5 flex w-full justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">Review Hotelbeds rate →</Link> : <Link href={`/concierge?q=${encodeURIComponent(`Help me book ${hotel.property_name} in ${destination}, ${checkIn} to ${checkOut}`)}`} className="mt-5 flex w-full justify-center rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold">Booking help →</Link>}
          </div>
        </article>;
      })}</div>
    </section>
  </main>;
}
