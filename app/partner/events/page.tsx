"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EventItem = {
  id: string;
  title: string;
  category: string;
  venue_name: string | null;
  start_at: string | null;
  status: string;
  featured: boolean;
};

const statuses = ["all", "pending", "approved", "rejected"];

export default function PartnerEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMessage("Please login first."); return; }
        const { data, error } = await supabase.from("events").select("id,title,category,venue_name,start_at,status,featured").eq("submitted_by", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load experiences.");
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(event => (status === "all" || event.status === status) && (!q || [event.title, event.category, event.venue_name || ""].join(" ").toLowerCase().includes(q)));
  }, [events, status, query]);

  function statusStyle(value: string) {
    if (value === "approved") return "bg-green-100 text-green-700";
    if (value === "rejected") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  }

  function formatDate(value: string | null) {
    if (!value) return "Date not set";
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link href="/partner/dashboard" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Partner Portal</p>
          </div>
          <Link href="/partner/events/create" className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">+ Create Experience</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-black">My Experiences</h1>
            <p className="mt-3 text-slate-500">Manage submissions, review status and open your published listings.</p>
          </div>
          <Link href="/partner/dashboard" className="font-bold text-slate-600 hover:text-slate-900">← Dashboard</Link>
        </div>

        {message && <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{message}</div>}

        <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your experiences..." className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-orange-500" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {statuses.map(item => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-xl px-4 py-3 text-sm font-bold capitalize whitespace-nowrap ${status === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400">Showing {filtered.length} of {events.length} experiences</p>
        </div>

        {loading ? <div className="mt-8 rounded-3xl bg-white p-10 text-center">Loading experiences...</div> : filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-10 text-center">
            <h2 className="text-2xl font-black">{events.length ? "No matching experiences" : "No experiences yet"}</h2>
            <p className="mt-3 text-slate-500">{events.length ? "Try another search or status filter." : "Start by creating your first SafariPlug listing."}</p>
            {!events.length && <Link href="/partner/events/create" className="mt-5 inline-block rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Create your first experience</Link>}
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {filtered.map(event => (
              <article key={event.id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">{event.title}</h2>
                      {event.featured && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">Featured</span>}
                    </div>
                    <p className="mt-2 text-slate-500">{event.category} · {event.venue_name || "Venue not added"}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-400">{formatDate(event.start_at)}</p>
                    <span className={`mt-4 inline-block rounded-full px-4 py-2 text-xs font-black uppercase ${statusStyle(event.status)}`}>{event.status}</span>
                    {event.status === "rejected" && <p className="mt-3 text-sm text-red-600">This listing needs changes before it can be published.</p>}
                    {event.status === "pending" && <p className="mt-3 text-sm text-orange-600">Your listing is awaiting SafariPlug review.</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {event.status === "approved" && <Link href={`/events/${event.id}`} className="rounded-xl border px-5 py-3 font-bold">View Listing</Link>}
                    {event.status === "rejected" && <Link href={`/partner/events/edit/${event.id}`} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Fix & Resubmit</Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
