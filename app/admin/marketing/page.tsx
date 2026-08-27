"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { generateMarketingDraft } from "./actions/generate";
import LuxuryImage from "@/components/LuxuryImage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EventItem = {
  id: string;
  title: string;
  category: string | null;
  venue_name: string | null;
  price: number | null;
  currency: string | null;
  start_at: string;
  status: string;
  is_featured: boolean | null;
  image_url: string | null;
};

type Platform = "instagram" | "whatsapp" | "newsletter";

export default function MarketingStudioPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const [activeDraft, setActiveDraft] = useState<{ title: string; copy: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("ai_discovered_events")
        .select("id, title, category, venue_name, price, currency, start_at, status, is_featured, image_url")
        .order("start_at", { ascending: true });

      if (error) {
        console.error("Error fetching studio events:", error.message);
      } else {
        setEvents((data || []) as EventItem[]);
      }
      setLoading(false);
    }

    fetchEvents();
  }, []);

  const handleGenerate = async (eventId: string, eventTitle: string) => {
    setGeneratingId(eventId);
    setErrorMsg(null);

    try {
      const result = await generateMarketingDraft({
        eventId,
        platform: selectedPlatform,
      });
      if (result.success && result.generatedCopy) {
        setActiveDraft({ title: eventTitle, copy: result.generatedCopy });
      } else {
        setErrorMsg(result.error || "Failed to generate draft.");
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "An unexpected error occurred.");
    } finally {
      setGeneratingId(null);
    }
  };

  const approved = events.filter((event) => event.status === "approved");
  const needsReview = events.filter(
    (event) => event.status === "pending_review" || !event.status
  );

  return (
    <main className="min-h-screen bg-black p-8 font-sans text-white selection:bg-amber-500 selection:text-black md:p-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 border-b border-zinc-800 pb-6 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
                Amani Engine // V2.6
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Marketing Studio</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Autonomous promotional generation for approved experiences.
            </p>
          </div>
          <Link
            href="/admin/ai-events"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium transition-colors hover:border-amber-500"
          >
            &larr; Curation Dashboard
          </Link>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric label="Total Monitored" value={events.length} />
          <Metric label="Approved Ready" value={approved.length} highlighted />
          <Metric label="Pending Review" value={needsReview.length} />
        </div>

        <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Target Channel:</span>
            {(["instagram", "whatsapp", "newsletter"] as const).map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs capitalize transition-all ${
                  selectedPlatform === platform
                    ? "bg-amber-500 font-bold text-black shadow-lg shadow-amber-500/20"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                {platform}
              </button>
            ))}
          </div>
          {errorMsg && (
            <span className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-1 font-mono text-xs text-red-400">
              Error: {errorMsg}
            </span>
          )}
        </div>

        <section className="space-y-6">
          <h2 className="flex items-center gap-2 font-mono text-lg font-bold tracking-wide text-zinc-200">
            {"// APPROVED EXPERIENCES REQUIRING CAMPAIGNS"}
          </h2>

          {loading ? (
            <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950 py-24 text-center font-mono text-sm text-zinc-500">
              Initializing studio telemetry...
            </div>
          ) : approved.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-20 text-center">
              <p className="font-mono text-sm text-zinc-400">No approved experiences available for marketing generation.</p>
              <Link href="/admin/ai-events" className="mt-4 inline-block font-mono text-xs text-amber-400 underline hover:text-amber-300">
                Authorize events in curation dashboard &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {approved.map((event) => (
                <div key={event.id} className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition-all hover:border-amber-500/40">
                  <div className="relative h-44 w-full overflow-hidden bg-zinc-900">
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black p-4 text-center">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
                        {event.category || "Aurelian Hospitality"}
                      </span>
                    </div>
                    <LuxuryImage
                      src={event.image_url}
                      alt={event.title}
                      className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    {event.is_featured && (
                      <span className="absolute right-3 top-3 rounded bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-black">
                        Sponsored
                      </span>
                    )}
                  </div>
                  <div className="flex flex-grow flex-col justify-between p-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        {event.category || "General"}
                      </span>
                    </div>
                    <h3 className="line-clamp-1 text-lg font-bold tracking-tight transition-colors group-hover:text-amber-300">
                      {event.title}
                    </h3>
                    <div className="mt-3 space-y-1.5 font-mono text-xs text-zinc-400">
                      <p>📍 {event.venue_name || "Location TBD"}</p>
                      <p>📅 {new Date(event.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-zinc-900 pt-4">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {event.price && event.price > 0 ? `${event.currency || "KES"} ${event.price}` : "Free"}
                    </span>
                    <button
                      onClick={() => handleGenerate(event.id, event.title)}
                      disabled={generatingId === event.id}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 font-mono text-xs font-bold text-black shadow-md shadow-amber-500/10 transition-all hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {generatingId === event.id ? "Generating..." : `Generate ${selectedPlatform}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {activeDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl md:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Amani Output // {selectedPlatform}</span>
                  <h3 className="mt-1 text-xl font-bold">{activeDraft.title}</h3>
                </div>
                <button onClick={() => setActiveDraft(null)} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                  Close [ESC]
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-900 bg-black p-4 font-mono text-xs leading-relaxed text-zinc-300 md:p-6">
                {activeDraft.copy}
              </div>
              <div className="mt-6 flex justify-end border-t border-zinc-800 pt-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeDraft.copy);
                    alert("Draft copied to clipboard.");
                  }}
                  className="rounded-xl bg-amber-500 px-4 py-2 font-mono text-xs font-bold text-black transition-colors hover:bg-amber-400"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, highlighted = false }: { label: string; value: number; highlighted?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-zinc-950 p-6 ${highlighted ? "border-amber-500/30" : "border-zinc-800"}`}>
      {highlighted && <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/5 blur-2xl" />}
      <span className={`font-mono text-[11px] uppercase tracking-wider ${highlighted ? "text-amber-400" : "text-zinc-500"}`}>{label}</span>
      <p className={`mt-2 font-mono text-3xl font-extrabold ${highlighted ? "text-amber-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
