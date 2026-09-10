"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EventRow = { status: string; start_at: string | null };

export default function PartnerDashboardPage() {
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: profile }, { data: company }, { data: rows }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("businesses").select("name").eq("owner_id", user.id).maybeSingle(),
        supabase.from("events").select("status,start_at").eq("submitted_by", user.id),
      ]);
      setName(profile?.full_name || "");
      setBusiness(company?.name || "");
      setEvents(rows || []);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: events.length,
      approved: events.filter(e => e.status === "approved").length,
      pending: events.filter(e => e.status === "pending").length,
      rejected: events.filter(e => e.status === "rejected").length,
      upcoming: events.filter(e => e.status === "approved" && e.start_at && new Date(e.start_at).getTime() >= now).length,
    };
  }, [events]);

  if (loading) return <main className="min-h-screen flex items-center justify-center bg-slate-100">Loading dashboard...</main>;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link>
          <div className="flex gap-3">
            <Link href="/partner/events" className="rounded-xl border px-4 py-3 font-bold">My Experiences</Link>
            <Link href="/partner/events/create" className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Create Experience</Link>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-500">Partner Portal</p>
        <h1 className="mt-3 text-4xl font-black">Welcome {name || "Partner"} 👋</h1>
        <p className="mt-3 text-slate-500">Manage your SafariPlug experiences and grow your audience.</p>

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-400">BUSINESS PROFILE</p>
          <h2 className="mt-2 text-2xl font-black">{business || "Business not added"}</h2>
          <p className="mt-2 text-slate-500">Your experiences appear on SafariPlug after approval.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total", stats.total, "text-slate-900"],
            ["Approved", stats.approved, "text-green-600"],
            ["Pending", stats.pending, "text-orange-500"],
            ["Needs changes", stats.rejected, "text-red-600"],
            ["Upcoming", stats.upcoming, "text-blue-600"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
              <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link href="/partner/events" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <h3 className="text-xl font-black">Manage Experiences</h3>
            <p className="mt-2 text-slate-500">Review status, upcoming dates and published listings.</p>
          </Link>
          <Link href="/partner/events/create" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <h3 className="text-xl font-black">Add Experience</h3>
            <p className="mt-2 text-slate-500">Submit a new event, activity or attraction for review.</p>
          </Link>
          <Link href="/business/services" className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <h3 className="text-xl font-black">Service Workspace</h3>
            <p className="mt-2 text-slate-500">Manage services, team, availability and customer bookings.</p>
          </Link>
        </div>

        {stats.rejected > 0 && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-black text-red-900">Some experiences need attention</h2>
            <p className="mt-2 text-red-800">Open My Experiences to review listings that were not approved and make the necessary changes.</p>
            <Link href="/partner/events" className="mt-4 inline-block rounded-xl bg-red-600 px-4 py-3 font-bold text-white">Review listings</Link>
          </div>
        )}
      </section>
    </main>
  );
}
