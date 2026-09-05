"use client";

import { useEffect, useMemo, useState } from "react";

type Staff = { id: string; display_name: string; bio?: string | null };
type Offering = { id: string; name: string; description?: string | null; duration_minutes: number; price: number; currency: string };
type Slot = { staffId: string; staffName: string; startsAt: string; endsAt: string; label: string };

export default function BookingForm({ profileId, offerings, staff, timezone = "Africa/Nairobi" }: { profileId: string; offerings: Offering[]; staff: Staff[]; timezone?: string }) {
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? "");
  const offering = useMemo(() => offerings.find(x => x.id === offeringId) ?? offerings[0], [offerings, offeringId]);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const minimumDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0,10);
  }, []);

  useEffect(() => {
    setSlot(null); setStaffId(""); setSlots([]); setMessage("");
    if (!offering || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`/api/services/availability?serviceProfileId=${encodeURIComponent(profileId)}&offeringId=${encodeURIComponent(offering.id)}&date=${encodeURIComponent(date)}`, { cache:"no-store" })
      .then(async r => { const j=await r.json(); if(!r.ok) throw new Error(j.error ?? "Unable to load availability"); return j; })
      .then(j => { if(!cancelled) setSlots(j.slots ?? []); })
      .catch(e => { if(!cancelled) setMessage(e instanceof Error ? e.message : "Unable to load availability"); })
      .finally(() => { if(!cancelled) setLoadingSlots(false); });
    return () => { cancelled=true; };
  }, [profileId, offering?.id, date]);

  const visibleSlots = useMemo(() => staffId ? slots.filter(x => x.staffId === staffId) : slots, [slots, staffId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!offering || !slot) { setMessage("Choose an available time first."); return; }
    setBusy(true); setMessage(""); setSuccess(false);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/services/appointments", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ serviceProfileId:profileId, offeringId:offering.id, staffId:slot.staffId, customerName:f.get("name"), customerEmail:f.get("email"), customerPhone:f.get("phone"), startsAt:slot.startsAt, customerNotes:f.get("notes") }) });
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? "That time is no longer available. Please choose another slot.");
      setSuccess(true); setMessage(`Appointment ${j.appointment.public_id} ${j.appointment.status === "pending" ? "requested" : "confirmed"}.`); e.currentTarget.reset(); setSlot(null); setDate(""); setStaffId(""); setSlots([]);
    } catch(err) { setMessage(err instanceof Error ? err.message : "Unable to complete your booking."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-6 rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_24px_80px_-35px_rgba(0,0,0,.35)] sm:p-8">
    <div className="border-b border-black/8 pb-5"><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-black/45">Reserve your time</p><div className="mt-2 flex items-start justify-between gap-4"><h3 className="text-xl font-semibold tracking-tight">Book an appointment</h3><span className="text-xs text-black/40">{timezone}</span></div></div>
    <div className="mt-6 space-y-4">
      <label className="block text-sm font-medium">Service<select value={offeringId} onChange={e=>setOfferingId(e.target.value)} required className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30">{offerings.map(x=><option key={x.id} value={x.id}>{x.name} · {x.duration_minutes} min · {x.currency} {Number(x.price).toLocaleString()}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Date<input type="date" min={minimumDate} value={date} onChange={e=>setDate(e.target.value)} required className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium">Specialist<span className="mt-2 block text-xs font-normal text-black/40">Optional — we can show everyone qualified.</span><select value={staffId} onChange={e=>{setStaffId(e.target.value);setSlot(null)}} className="mt-1 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"><option value="">Any available specialist</option>{staff.map(s=><option key={s.id} value={s.id}>{s.display_name}</option>)}</select></label>
      </div>
      <div><div className="flex items-center justify-between"><p className="text-sm font-medium">Available times</p>{loadingSlots && <span className="text-xs text-black/40">Checking live availability…</span>}</div>{!date ? <p className="mt-2 rounded-xl bg-black/[.03] px-4 py-4 text-sm text-black/45">Choose a date to see real appointment times.</p> : !loadingSlots && !visibleSlots.length ? <p className="mt-2 rounded-xl bg-black/[.03] px-4 py-4 text-sm text-black/45">No open times on this date. Try another day.</p> : <div className="mt-3 grid max-h-52 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">{visibleSlots.map(x=><button type="button" key={`${x.staffId}-${x.startsAt}`} onClick={()=>setSlot(x)} className={`rounded-xl border px-3 py-3 text-left transition ${slot?.startsAt===x.startsAt && slot.staffId===x.staffId ? "border-black bg-black text-white" : "border-black/10 bg-white hover:border-black/30"}`}><span className="block text-sm font-semibold">{x.label}</span><span className={`mt-1 block text-[11px] ${slot?.startsAt===x.startsAt && slot.staffId===x.staffId ? "text-white/60" : "text-black/40"}`}>{x.staffName}</span></button>)}</div>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Full name<input name="name" required placeholder="Your name" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium">Email<input name="email" type="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
      </div>
      <label className="block text-sm font-medium">Phone<input name="phone" placeholder="+254 …" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
      <label className="block text-sm font-medium">Anything we should know?<textarea name="notes" rows={3} placeholder="Optional notes" className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
    </div>
    {offering && <div className="mt-5 flex items-center justify-between rounded-xl bg-black/[.03] px-4 py-3 text-sm"><span>{offering.name} · {offering.duration_minutes} min</span><strong>{offering.currency} {Number(offering.price).toLocaleString()}</strong></div>}
    <button disabled={busy || !slot} className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Securing your appointment…" : slot ? "Confirm appointment" : "Choose a time"}</button>
    {message && <p className={`mt-3 rounded-xl px-4 py-3 text-sm ${success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message}</p>}
    <p className="mt-4 text-center text-[11px] leading-5 text-black/40">Availability is checked again when you confirm, so another customer cannot take the same slot unnoticed.</p>
  </form>;
}
