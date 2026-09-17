"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type Guest = { name: string; surname: string; type: "AD" | "CH"; age?: string };

export default function HotelbedsBookPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const hotelName = params.get("hotelName") || "Hotel stay";
  const bookingToken = params.get("bookingToken") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guestCount = Math.max(1, Math.min(10, Number(params.get("guests") || 1)));
  const displayedTotal = Number(params.get("total") || 0);
  const currency = params.get("currency") || "KES";
  const tripId = params.get("tripId") || "";
  const [guests, setGuests] = useState<Guest[]>(() => Array.from({ length: guestCount }, () => ({ name: "", surname: "", type: "AD" })));
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateGuest(index: number, patch: Partial<Guest>) {
    setGuests(current => current.map((guest, i) => i === index ? { ...guest, ...patch } : guest));
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!bookingToken) { setError("This Hotelbeds search session is incomplete. Please search again."); return; }
    if (!phone.trim()) { setError("M-Pesa phone number is required."); return; }
    if (guests.some((guest) => !guest.name.trim() || !guest.surname.trim() || (guest.type === "CH" && !guest.age))) {
      setError("Enter the name of every passenger and the age of every child."); return;
    }
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/v1/hotels/hotelbeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          bookingToken,
          currency: "KES",
          customerPhone: phone.trim(),
          tripId: tripId || undefined,
          paxes: guests.map((guest) => ({ type: guest.type, name: guest.name.trim(), surname: guest.surname.trim(), age: guest.type === "CH" ? Number(guest.age) : undefined, roomId: 1 })),
        }),
      });
      const body = await response.json();
      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) throw new Error(body?.message || "Unable to start Hotelbeds payment.");
      if (!body?.bookingId) throw new Error("SafariPlug did not return a booking session.");
      window.location.href = `/hotels/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(body.bookingId)}${tripId ? `&tripId=${encodeURIComponent(tripId)}` : ""}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Hotelbeds payment.");
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-[#111]">
    <div className="mx-auto max-w-4xl">
      <Link href="/hotels" className="text-sm font-semibold text-black/55">← Back to hotel search</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <section><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug / Hotelbeds</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{hotelName}</h1><p className="mt-3 text-sm text-black/50">{checkIn} → {checkOut} · {guestCount} passenger{guestCount === 1 ? "" : "s"}</p><div className="mt-8 rounded-3xl bg-white p-6"><h2 className="font-semibold">Before payment</h2><p className="mt-2 text-sm leading-6 text-black/55">SafariPlug will revalidate RECHECK rates exactly once when required. BOOKABLE rates are not re-searched. Your M-Pesa payment is collected before Hotelbeds confirmation, and SafariPlug will not blindly retry an ambiguous supplier confirmation.</p></div></section>
        <form onSubmit={checkout} className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-black/40">Review & pay</p>
          <div className="mt-4 rounded-2xl bg-black/[.035] p-4"><p className="text-xs text-black/45">Search total shown</p><p className="mt-1 text-3xl font-semibold">{currency} {Number.isFinite(displayedTotal) ? displayedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</p><p className="mt-2 text-xs leading-5 text-black/45">The server revalidates the governed Hotelbeds rate and calculates the final SafariPlug amount before starting M-Pesa.</p></div>
          <div className="mt-6 space-y-4"><h3 className="font-semibold">Passenger details</h3>{guests.map((guest, index) => <div key={index} className="rounded-2xl border border-black/8 p-3"><div className="grid grid-cols-2 gap-3"><input value={guest.name} onChange={e => updateGuest(index, { name: e.target.value })} placeholder={`Passenger ${index + 1} first name`} className="rounded-xl border border-black/10 px-3 py-3" /><input value={guest.surname} onChange={e => updateGuest(index, { surname: e.target.value })} placeholder="Last name" className="rounded-xl border border-black/10 px-3 py-3" /></div><div className="mt-3 flex gap-3"><select value={guest.type} onChange={e => updateGuest(index, { type: e.target.value as "AD" | "CH", age: e.target.value === "AD" ? undefined : guest.age })} className="rounded-xl border border-black/10 px-3 py-3"><option value="AD">Adult</option><option value="CH">Child</option></select>{guest.type === "CH" ? <input type="number" min="0" max="17" value={guest.age || ""} onChange={e => updateGuest(index, { age: e.target.value })} placeholder="Age" className="w-28 rounded-xl border border-black/10 px-3 py-3" /> : null}</div></div>)}<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="M-Pesa phone e.g. 2547…" className="w-full rounded-xl border border-black/10 px-3 py-3" /></div>
          {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button disabled={submitting || !bookingToken} className="mt-6 w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white disabled:opacity-50">{submitting ? "Starting M-Pesa payment…" : "Continue with M-Pesa"}</button>
          <p className="mt-3 text-center text-[11px] leading-5 text-black/40">No Hotelbeds reservation is created until payment succeeds.</p>
        </form>
      </div>
    </div>
  </main>;
}
