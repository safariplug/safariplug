"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type RoomPackage = {
  quoteId: string;
  packageId?: string;
  roomName?: string;
  mealType?: string;
  mealDescription?: string;
  amenities?: string[];
  price: number;
  customerCurrency?: string;
  isRefundable?: boolean;
};

type Policy = {
  packageId?: string;
  isRefundable?: boolean;
  freeCancellationUntil?: string | null;
  fees?: Array<{ fromDate?: string; toDate?: string | null; amount?: number; currency?: string; percentage?: number | null }>;
  remarks?: string[] | null;
};

type Guest = { firstName: string; lastName: string };

export default function HotelBookPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-[#111]"><div className="mx-auto max-w-5xl"><div className="rounded-3xl bg-white p-8">Loading hotel checkout…</div></div></main>}><HotelBookPageContent /></Suspense>;
}

function HotelBookPageContent() {
  const params = useSearchParams();
  const hotelId = params.get("hotelId") || "";
  const hotelName = params.get("hotelName") || "Hotel stay";
  const initialSearchKey = params.get("searchKey") || "";
  const [searchKey, setSearchKey] = useState(initialSearchKey);
  const regionId = params.get("regionId") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guestCount = Math.max(1, Math.min(20, Number(params.get("guests") || 1)));
  const currency = params.get("currency") || "KES";
  const tripId = params.get("tripId") || "";

  const [packages, setPackages] = useState<RoomPackage[]>([]);
  const [selected, setSelected] = useState<RoomPackage | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [guests, setGuests] = useState<Guest[]>(() => Array.from({ length: guestCount }, () => ({ firstName: "", lastName: "" })));
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hotelId || !initialSearchKey || !regionId || !checkIn || !checkOut) {
      setError("This hotel search session is incomplete. Please search again.");
      setLoading(false);
      return;
    }
    const cacheKey = "safariplug:hotel-room-preflight:" + hotelId + ":" + checkIn + ":" + checkOut + ":" + guestCount;
    try {
      const cachedRaw = window.sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { createdAt?: number; searchKey?: string; packages?: RoomPackage[] };
        const fresh = typeof cached.createdAt === "number" && Date.now() - cached.createdAt < 120000;
        const rows = Array.isArray(cached.packages) ? cached.packages : [];
        if (fresh && rows.length) {
          setSearchKey(String(cached.searchKey || initialSearchKey));
          setPackages(rows);
          setSelected(rows[0] || null);
          setLoading(false);
          return;
        }
        window.sessionStorage.removeItem(cacheKey);
      }
    } catch {
      window.sessionStorage.removeItem(cacheKey);
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/v1/hotels/locktrip/public", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "rooms", hotelId, searchKey: initialSearchKey, regionId, checkIn, checkOut, rooms: [{ adults: guestCount, childrenAges: [] }], currency }),
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message || "Unable to load hotel rooms.");
        if (cancelled) return;
        const rows = Array.isArray(body?.data?.packages) ? body.data.packages as RoomPackage[] : [];
        const activeSearchKey = String(body?.searchKey || body?.data?.searchKey || initialSearchKey);
        setSearchKey(activeSearchKey);
        setPackages(rows);
        if (rows[0]) setSelected(rows[0]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load hotel rooms.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [hotelId, initialSearchKey, regionId, checkIn, checkOut, guestCount, currency]);

  useEffect(() => {
    if (!selected?.quoteId) { setPolicy(null); return; }
    let cancelled = false;
    const loadPolicy = async () => {
      try {
        const response = await fetch("/api/v1/hotels/locktrip/public", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "cancellation_policy", hotelId, searchKey, quoteIds: [selected.quoteId] }),
          cache: "no-store",
        });
        const body = await response.json();
        if (!cancelled && response.ok) setPolicy(Array.isArray(body?.data?.policies) ? body.data.policies[0] || null : null);
      } catch { if (!cancelled) setPolicy(null); }
    };
    void loadPolicy();
    return () => { cancelled = true; };
  }, [selected, hotelId, searchKey]);

  function updateGuest(index: number, field: keyof Guest, value: string) {
    setGuests(current => current.map((guest, i) => i === index ? { ...guest, [field]: value } : guest));
  }

  function checkoutIdempotencyKey() {
    if (!selected?.quoteId) throw new Error("Select a room package first.");
    const storageKey = `safariplug:locktrip-hotel-intent:${selected.quoteId.slice(-48)}:${searchKey.slice(-24)}:${tripId || "standalone"}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (guests.some(guest => !guest.firstName.trim() || !guest.lastName.trim())) { setError("Please enter the first and last name for every adult guest."); return; }
    if (!email.trim() || !phone.trim()) { setError("Email and M-Pesa phone number are required."); return; }
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/v1/hotels/locktrip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          idempotencyKey: checkoutIdempotencyKey(),
          quoteId: selected.quoteId,
          searchKey,
          hotelId,
          hotelName,
          tripId: tripId || undefined,
          checkIn,
          checkOut,
          currency: "KES",
          method: "mpesa",
          customerPhone: phone.trim(),
          email: email.trim(),
          rooms: [{ roomIndex: 0, guests: guests.map((guest, index) => ({ firstName: guest.firstName.trim(), lastName: guest.lastName.trim(), title: "Mr", email: index === 0 ? email.trim() : undefined, phone: index === 0 ? phone.trim() : undefined, isLeadGuest: index === 0 })) }],
          contactPerson: { firstName: guests[0]?.firstName.trim(), lastName: guests[0]?.lastName.trim(), email: email.trim(), phone: phone.trim() },
          specialRequests: specialRequests.trim() || undefined,
        }),
      });
      const body = await response.json();
      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) throw new Error(body?.message || "Unable to start hotel payment.");
      const bookingId = body?.booking?.preparedBookingId;
      if (!bookingId) {
        if (body?.reconciliation === "manual_required") throw new Error(body?.message || "This checkout needs manual reconciliation before SafariPlug can safely continue.");
        throw new Error(body?.message || "The hotel checkout is still initializing. Please check your booking status before trying again.");
      }
      window.location.href = `/hotels/booking-result?bookingId=${encodeURIComponent(String(bookingId))}${tripId ? `&tripId=${encodeURIComponent(tripId)}` : ""}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start hotel payment.");
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-[#111]">
    <div className="mx-auto max-w-5xl">
      <Link href={tripId ? `/hotels?tripId=${encodeURIComponent(tripId)}` : "/hotels"} className="text-sm font-semibold text-black/55">← Back to hotel search</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug hotel checkout</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{hotelName}</h1>
          <p className="mt-3 text-sm text-black/50">{checkIn} → {checkOut} · {guestCount} adult{guestCount === 1 ? "" : "s"} · 1 room</p>
          {loading ? <div className="mt-8 rounded-3xl bg-white p-8">Loading live room packages…</div> : null}
          {!loading && packages.length === 0 ? <div className="mt-8 rounded-3xl bg-white p-8">No bookable room packages are currently available. Please search again.</div> : null}
          <div className="mt-8 space-y-4">{packages.map(pkg => <button key={pkg.quoteId} type="button" onClick={() => setSelected(pkg)} className={`w-full rounded-3xl border p-5 text-left ${selected?.quoteId === pkg.quoteId ? "border-black bg-white shadow-sm" : "border-black/10 bg-white/70"}`}>
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{pkg.roomName || "Available room"}</h2><p className="mt-1 text-sm text-black/50">{pkg.mealType || "Room package"}</p></div><p className="text-xl font-semibold">{pkg.customerCurrency || currency} {Number(pkg.price).toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>
            {pkg.amenities?.length ? <p className="mt-3 text-xs leading-5 text-black/45">{pkg.amenities.slice(0,6).join(" · ")}</p> : null}
            <p className="mt-3 text-xs font-semibold text-black/55">{pkg.isRefundable ? "Refundable option" : "Cancellation restrictions may apply"}</p>
          </button>)}</div>
        </section>
        <aside>{selected ? <form onSubmit={checkout} className="rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-black/40">Review & pay</p>
          <div className="mt-4 rounded-2xl bg-black/[.035] p-4"><p className="text-xs text-black/45">SafariPlug customer total</p><p className="mt-1 text-3xl font-semibold">{selected.customerCurrency || currency} {Number(selected.price).toLocaleString(undefined,{maximumFractionDigits:2})}</p><p className="mt-2 text-xs leading-5 text-black/45">Total price for your stay. Price is confirmed before payment.</p></div>
          <div className="mt-5 rounded-2xl border border-black/8 p-4"><p className="text-sm font-semibold">Cancellation</p>{policy ? <>{policy.freeCancellationUntil ? <><p className="mt-2 text-sm font-medium text-black/65">Free cancellation until {policy.freeCancellationUntil}</p><p className="mt-1 text-xs text-black/50">Cancellation fees or restrictions may apply after this deadline.</p></> : <p className="mt-2 text-sm text-black/60">{policy.isRefundable ? "Refundable under the supplier policy" : "Non-refundable / restricted"}</p>}{!policy.freeCancellationUntil && policy.fees?.length ? <p className="mt-2 text-xs text-black/45">Provider cancellation fees apply under the supplier policy.</p> : null}</> : <p className="mt-2 text-xs text-black/45">Checking the supplier&apos;s cancellation policy…</p>}</div>
          <div className="mt-6 space-y-4"><h3 className="font-semibold">Guest details</h3>{guests.map((guest,index)=><div key={index} className="grid grid-cols-2 gap-3"><input value={guest.firstName} onChange={e=>updateGuest(index,"firstName",e.target.value)} placeholder={`Guest ${index+1} first name`} className="rounded-xl border border-black/10 px-3 py-3"/><input value={guest.lastName} onChange={e=>updateGuest(index,"lastName",e.target.value)} placeholder="Last name" className="rounded-xl border border-black/10 px-3 py-3"/></div>)}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Contact email" className="w-full rounded-xl border border-black/10 px-3 py-3"/><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="M-Pesa phone e.g. 2547…" className="w-full rounded-xl border border-black/10 px-3 py-3"/><textarea value={specialRequests} onChange={e=>setSpecialRequests(e.target.value)} placeholder="Special requests (optional)" className="min-h-24 w-full rounded-xl border border-black/10 px-3 py-3"/></div>
          {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button disabled={submitting} className="mt-6 w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white disabled:opacity-50">{submitting ? "Starting M-Pesa payment…" : `Pay ${selected.customerCurrency || currency} ${Number(selected.price).toLocaleString(undefined,{maximumFractionDigits:2})} with M-Pesa`}</button>
          <p className="mt-3 text-center text-[11px] leading-5 text-black/40">No booking is confirmed until payment succeeds and the hotel supplier confirms the reservation.</p>
        </form> : null}</aside>
      </div>
    </div>
  </main>;
}
