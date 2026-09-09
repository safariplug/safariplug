"use client";

import { useEffect, useMemo, useState } from "react";

type Staff = { id: string; display_name: string; status: string };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };
type Blockout = { id: string; staff_id: string; starts_at: string; ends_at: string; reason?: string | null };
type Appointment = { id: string; public_id: string; staff_id: string; customer_name: string; starts_at: string; ends_at: string; status: string; service_offerings?: { name?: string } | null };

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SupplierCalendarPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blockouts, setBlockouts] = useState<Blockout[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [startDay, setStartDay] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  const range = useMemo(() => { const from = new Date(startDay); const to = new Date(startDay); to.setDate(to.getDate() + 14); return { from: from.toISOString(), to: to.toISOString() }; }, [startDay]);

  async function load() {
    setLoading(true); const r = await fetch(`/api/supplier/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, { cache: "no-store" });
    const d = await r.json();
    if (r.ok) { setStaff(d.staff || []); setAvailability(d.availability || []); setBlockouts(d.blockouts || []); setAppointments(d.appointments || []); setTimezone(d.timezone || "UTC"); if (!selectedStaff && d.staff?.[0]) setSelectedStaff(d.staff[0].id); }
    else setMessage(d.error || "Unable to load calendar.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, [range.from, range.to]);

  async function post(body: Record<string, unknown>) {
    setMessage(""); const r = await fetch("/api/supplier/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const d = await r.json(); setMessage(r.ok ? "Calendar updated." : d.error || "Unable to update calendar."); if (r.ok) void load();
  }

  async function addAvailability(day: number) {
    const start = window.prompt(`Start time for ${days[day]}`, "09:00"); if (!start) return;
    const end = window.prompt(`End time for ${days[day]}`, "17:00"); if (!end) return;
    await post({ action: "availability", staffId: selectedStaff, dayOfWeek: day, startTime: start, endTime: end });
  }

  async function blockTime() {
    const date = window.prompt("Date (YYYY-MM-DD)"); if (!date) return;
    const start = window.prompt("Start time (HH:MM)", "09:00"); if (!start) return;
    const end = window.prompt("End time (HH:MM)", "17:00"); if (!end) return;
    const reason = window.prompt("Reason (optional)", "Unavailable");
    await post({ action: "blockout", staffId: selectedStaff, startsAt: `${date}T${start}:00`, endsAt: `${date}T${end}:00`, reason });
  }

  const selectedAvailability = availability.filter(x => x.staff_id === selectedStaff);
  const selectedAppointments = appointments.filter(x => x.staff_id === selectedStaff);
  const selectedBlockouts = blockouts.filter(x => x.staff_id === selectedStaff);
  const upcoming = Array.from({ length: 14 }, (_, i) => { const d = new Date(startDay); d.setDate(d.getDate() + i); return d; });

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-sm uppercase tracking-[.2em] text-black/40">Supplier Portal</p><h1 className="mt-2 text-4xl font-semibold">Availability calendar</h1><p className="mt-2 max-w-2xl text-black/60">Set when you work, block time off, and see customer bookings. Booked appointment times are automatically protected from double-booking.</p></div>
      <div className="flex gap-2"><button onClick={() => setStartDay(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="rounded-full border border-black/15 px-4 py-2 text-sm">← Previous</button><button onClick={() => setStartDay(new Date())} className="rounded-full border border-black/15 px-4 py-2 text-sm">Today</button><button onClick={() => setStartDay(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="rounded-full border border-black/15 px-4 py-2 text-sm">Next →</button></div>
    </div>

    <section className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 p-4"><label className="text-sm font-medium">Staff calendar <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className="ml-2 rounded-xl border border-black/15 px-3 py-2">{staff.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}</select></label><button disabled={!selectedStaff} onClick={blockTime} className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-40">Block time</button><span className="text-xs text-black/45">Timezone: {timezone}</span></section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Weekly working hours</h2><p className="mt-1 text-sm text-black/50">Add one or more availability windows for each day.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{days.map((day, i) => { const rows = selectedAvailability.filter(a => a.day_of_week === i); return <div key={day} className="rounded-xl bg-black/[.035] p-4"><div className="flex items-center justify-between"><span className="font-medium">{day}</span><button onClick={() => addAvailability(i)} disabled={!selectedStaff} className="text-xs underline disabled:opacity-30">+ hours</button></div>{rows.length ? rows.map(a => <div key={a.id} className="mt-2 flex items-center justify-between text-sm"><span>{a.start_time.slice(0,5)}–{a.end_time.slice(0,5)}</span><button onClick={() => post({ action: "delete_availability", staffId: selectedStaff, id: a.id })} className="text-xs text-black/40">Remove</button></div>) : <p className="mt-3 text-xs text-black/40">Closed</p>}</div> })}</div></section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Calendar</h2><p className="mt-1 text-sm text-black/50">Green = working hours · Red = booked · Gray = blocked</p></div><span className="text-sm text-black/45">{loading ? "Refreshing…" : `${selectedAppointments.length} active booking${selectedAppointments.length === 1 ? "" : "s"}`}</span></div><div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-7">{upcoming.slice(0,7).map((date, i) => { const key = date.toISOString().slice(0,10); const day = date.getDay(); const dayAppointments = selectedAppointments.filter(a => a.starts_at.slice(0,10) === key); const dayBlocks = selectedBlockouts.filter(b => b.starts_at.slice(0,10) === key); const hours = selectedAvailability.filter(a => a.day_of_week === day); return <div key={key} className="min-h-40 rounded-xl border border-black/10 p-3"><div className="flex justify-between"><div><div className="text-xs uppercase text-black/40">{shortDays[day]}</div><div className="font-semibold">{date.getDate()}</div></div><div className="text-xs text-black/40">{hours.length ? "Open" : "Closed"}</div></div>{hours.map(h => <div key={h.id} className="mt-2 rounded-lg bg-black/[.05] px-2 py-1 text-xs">{h.start_time.slice(0,5)}–{h.end_time.slice(0,5)}</div>)}{dayBlocks.map(b => <div key={b.id} className="mt-2 rounded-lg border border-black/15 px-2 py-2 text-xs"><b>Blocked</b><br />{new Date(b.starts_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", timeZone: timezone})}–{new Date(b.ends_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", timeZone: timezone})}</div>)}{dayAppointments.map(a => <div key={a.id} className="mt-2 rounded-lg bg-black px-2 py-2 text-xs text-white"><b>{new Date(a.starts_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", timeZone: timezone})}</b><br />{a.customer_name}<br /><span className="opacity-70">{a.service_offerings?.name || "Appointment"}</span></div>)}</div> })}</div></section>

    {message && <p className="mt-4 text-sm">{message}</p>}
    {!staff.length && !loading && <p className="mt-6 rounded-xl bg-black/[.04] p-4 text-sm">No staff calendar has been created for this supplier yet. Complete supplier onboarding and add a service before managing availability.</p>}
  </main>;
}
