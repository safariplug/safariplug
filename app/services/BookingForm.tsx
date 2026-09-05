"use client";

import { useMemo, useState } from "react";

type Staff = { id: string; display_name: string; bio?: string | null };
type Offering = { id: string; name: string; duration_minutes: number; price: number; currency: string };

export default function BookingForm({ profileId, offering, staff }: { profileId: string; offering: Offering; staff: Staff[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [startsAt, setStartsAt] = useState("");

  const minimum = useMemo(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMessage(""); setSuccess(false);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/services/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceProfileId: profileId, offeringId: offering.id, staffId, customerName: f.get("name"), customerEmail: f.get("email"), customerPhone: f.get("phone"), startsAt, customerNotes: f.get("notes") }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "That time is no longer available.");
      setSuccess(true); setMessage(`Appointment ${j.appointment.public_id} confirmed.`); e.currentTarget.reset(); setStaffId(""); setStartsAt("");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to complete your booking."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_24px_80px_-35px_rgba(0,0,0,.35)] sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-black/8 pb-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-black/45">Reserve your time</p><h3 className="mt-1 text-xl font-semibold tracking-tight">{offering.name}</h3></div>
        <div className="text-right"><p className="text-lg font-semibold">{offering.currency} {Number(offering.price).toLocaleString()}</p><p className="text-xs text-black/45">{offering.duration_minutes} min</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Your specialist<select name="staffId" value={staffId} onChange={e=>setStaffId(e.target.value)} required className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"><option value="">Choose a specialist</option>{staff.map(s=><option key={s.id} value={s.id}>{s.display_name}</option>)}</select></label>
        <label className="text-sm font-medium">Date & time<input name="startsAt" value={startsAt} onChange={e=>setStartsAt(e.target.value)} type="datetime-local" min={minimum} required className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium">Full name<input name="name" required placeholder="Your name" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium">Email<input name="email" type="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium sm:col-span-2">Phone<input name="phone" placeholder="+254 …" className="mt-2 w-full rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
        <label className="text-sm font-medium sm:col-span-2">Anything we should know?<textarea name="notes" rows={3} placeholder="Optional notes" className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-black/[.02] px-4 py-3 outline-none focus:border-black/30"/></label>
      </div>
      <button disabled={busy} className="mt-6 w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Securing your appointment…" : "Confirm appointment"}</button>
      {message && <p className={`mt-3 rounded-xl px-4 py-3 text-sm ${success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message}</p>}
      <p className="mt-4 text-center text-[11px] leading-5 text-black/40">Your appointment is confirmed only when the platform successfully secures the selected slot.</p>
    </form>
  );
}
