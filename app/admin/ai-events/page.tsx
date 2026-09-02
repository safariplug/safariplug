export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { approveAIEvent } from "./actions/approve";
import { rejectAIEvent } from "./actions/reject";

function parseEventDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(date: string | null) {
  if (!date) return "Date TBA";
  const parsed = parseEventDate(date);
  if (!parsed) return "Date TBA";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

function formatTime(date: string | null) {
  if (!date) return "Time TBA";
  const parsed = parseEventDate(date);
  if (!parsed) return "Time TBA";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function statusStyle(status: string | null) {
  if (status === "pending_review") return "bg-orange-100 text-orange-700";
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function confidenceStyle(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-orange-500";
  return "text-red-500";
}

function confidenceLabel(score: number | null) {
  if (score === null) return "Unknown";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Review";
  return "Low";
}

function formatStatus(status: string | null) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(price: number | string | null, currency: string | null) {
  if (price === null || price === undefined || price === "") return "Price TBA";
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price TBA";
  if (numericPrice === 0) return "Free";
  return `${currency || "KES"} ${numericPrice.toLocaleString()}`;
}

function isSuspiciousSource(sourceName: string | null, sourceUrl: string | null) {
  const source = `${sourceName || ""} ${sourceUrl || ""}`.toLowerCase();
  return source.includes("safariplug ai scout") || source.includes("localhost") || source.includes("example.com");
}

export default async function AIEventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = params.tab || "all";

  const { data, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("id,title,description,category,city,venue_name,venue_address,start_at,end_at,price,currency,image_url,source_url,source_name,confidence_score,status,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) console.error("AI EVENTS PAGE ERROR:", error);

  const allEvents = data || [];
  const pendingEvents = allEvents.filter((event) => event.status === "pending_review");
  const approvedEvents = allEvents.filter((event) => event.status === "approved");
  const rejectedEvents = allEvents.filter((event) => event.status === "rejected");
  const displayedEvents = tab === "pending" ? pendingEvents : tab === "approved" ? approvedEvents : tab === "rejected" ? rejectedEvents : allEvents;
  const realDiscoveries = allEvents.filter((event) => !isSuspiciousSource(event.source_name, event.source_url));
  const withImages = realDiscoveries.filter((event) => Boolean(event.image_url));
  const imageCoverage = realDiscoveries.length ? Math.round((withImages.length / realDiscoveries.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-4"><Link href="/admin" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-sm">S</Link><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">SafariPlug Intelligence</p><h1 className="text-xl font-black tracking-tight sm:text-2xl">AI Events</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><Link href="/admin/ai-scout" className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black transition hover:border-orange-300 hover:bg-orange-50 sm:px-5 sm:text-sm">AI Scout</Link><Link href="/events" className="rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-orange-500 sm:px-5 sm:text-sm">View Events</Link></div></div></header>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-7 text-white shadow-xl sm:p-10"><div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300"><span className="h-2 w-2 rounded-full bg-orange-400" /> AI Discovery Pipeline</div><div className="mt-6 flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-3xl"><h2 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Discover what is<span className="block text-orange-400">happening next.</span></h2><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">SafariPlug AI scans East Africa for real events, experiences and hidden gems. Review the evidence, verify the details and approve only the experiences worth publishing.</p></div><Link href="/admin/ai-scout" className="inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500 px-7 py-4 text-sm font-black text-white shadow-lg transition hover:bg-orange-400">Run AI Scout →</Link></div></div></section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Total Discoveries" value={allEvents.length} description="AI discoveries" /><StatCard label="Needs Review" value={pendingEvents.length} description="Awaiting approval" accent /><StatCard label="Published" value={approvedEvents.length} description="Live on SafariPlug" success /><StatCard label="Image Coverage" value={`${imageCoverage}%`} description={`${withImages.length} discoveries have images`} /></section>
        <section className="mt-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">Discovery inbox</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Review events</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Check the source, event details, image and confidence before publishing anything to SafariPlug.</p></div><div className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm ring-1 ring-slate-200">{pendingEvents.length} waiting for review</div></div><div className="mt-5 flex flex-wrap gap-3"><FilterLink href="/admin/ai-events" label={`All (${allEvents.length})`} active={tab === "all"} /><FilterLink href="/admin/ai-events?tab=pending" label={`Needs Review (${pendingEvents.length})`} active={tab === "pending"} /><FilterLink href="/admin/ai-events?tab=approved" label={`Published (${approvedEvents.length})`} active={tab === "approved"} /><FilterLink href="/admin/ai-events?tab=rejected" label={`Rejected (${rejectedEvents.length})`} active={tab === "rejected"} /></div></section>
        <section className="mt-6">{displayedEvents.length === 0 ? <EmptyState filtered={tab !== "all"} /> : <div className="space-y-5">{displayedEvents.map((event) => { const suspicious = isSuspiciousSource(event.source_name, event.source_url); const dateLabel = event.start_at ? `${formatDate(event.start_at)} · ${formatTime(event.start_at)}${event.end_at ? `–${formatTime(event.end_at)}` : ""}` : "Date TBA"; return <article key={event.id} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[280px_1fr_auto]"><div className="relative min-h-[230px] overflow-hidden bg-slate-950">{event.image_url ? <img src={event.image_url} alt={event.title || "AI discovered event"} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-800 to-orange-600"><div className="text-center text-white"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 text-3xl font-black">S</div><p className="mt-4 text-[9px] font-black uppercase tracking-[0.22em] text-white/50">Image pending</p></div></div>}<div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute left-4 top-4"><span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${statusStyle(event.status)}`}>{formatStatus(event.status)}</span></div>{event.image_url && <div className="absolute bottom-4 left-4"><span className="rounded-full bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">Image found</span></div>}</div><div className="p-6 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600">{event.category || "Uncategorized"}</span>{event.city && <span className="text-xs font-bold text-slate-400">{event.city}</span>}</div><h3 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{event.title || "Untitled discovery"}</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{event.description || "No description available."}</p></div><div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:min-w-[112px]"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Confidence</div><div className={`mt-1 text-2xl font-black ${confidenceStyle(event.confidence_score)}`}>{event.confidence_score ?? "—"}%</div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{confidenceLabel(event.confidence_score)}</div></div></div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><MetaItem label="When" value={dateLabel} /><MetaItem label="Venue" value={event.venue_name || "Venue TBA"} /><MetaItem label="Price" value={formatPrice(event.price, event.currency)} /></div><div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between"><div><span className="text-slate-400">Source</span><span className="ml-2 font-black text-slate-700">{event.source_name || "Unknown"}</span>{suspicious && <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-600">Verify source</span>}</div>{event.source_url && <a href={event.source_url} target="_blank" rel="noreferrer" className="font-black text-orange-500 transition hover:text-orange-600">View source →</a>}</div></div><div className="flex flex-col justify-center gap-3 border-t border-slate-100 bg-slate-50 p-5 lg:min-w-[190px] lg:border-l lg:border-t-0"><Link href={`/admin/ai-events/edit/${event.id}`} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black">Review / Edit</Link>{event.status === "pending_review" && <><form action={approveAIEvent}><input type="hidden" name="id" value={event.id} /><button type="submit" className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Approve & Publish</button></form><form action={rejectAIEvent}><input type="hidden" name="id" value={event.id} /><button type="submit" className="w-full rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-black text-red-600">Reject</button></form></>}{event.status === "approved" && <Link href="/events" target="_blank" className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">View Live Events</Link>}</div></div></article>; })}</div>}</section>
      </div>
    </main>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) { return <Link href={href} className={`rounded-full px-5 py-2 text-xs font-black ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-slate-950"}`}>{label}</Link>; }
function StatCard({ label, value, description, accent, success }: { label: string; value: number | string; description: string; accent?: boolean; success?: boolean }) { return <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>{accent && <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />}{success && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}</div><p className={`mt-4 text-4xl font-black ${accent ? "text-orange-500" : success ? "text-emerald-600" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs font-bold text-slate-400">{description}</p></div>; }
function MetaItem({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-700">{value}</div></div>; }
function EmptyState({ filtered }: { filtered: boolean }) { return <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center"><h3 className="text-xl font-black">{filtered ? "No events in this view" : "No discoveries yet"}</h3><p className="mt-2 text-sm text-slate-500">{filtered ? "Try another filter." : "Run AI Scout to discover upcoming experiences."}</p></div>; }
