"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { generateMarketingDraft } from "./actions/generate";
import { listMarketingDrafts } from "./actions/list";
import { approveMarketingDraft, rejectMarketingDraft } from "./actions/approve";
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

type MarketingDraft = {
  id: number;
  event_id: string | null;
  event_name: string;
  city: string | null;
  platform: string;
  draft_content: string;
  image_url: string | null;
  video_url: string | null;
  external_url: string | null;
  status: string;
  publish_status: string | null;
  approved_at: string | null;
  metricool_status: string | null;
  publish_error: string | null;
};

type Platform = "instagram" | "whatsapp" | "newsletter";

export default function MarketingStudioPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const [activeDraft, setActiveDraft] = useState<{ title: string; copy: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refreshDrafts() {
    setDraftsLoading(true);
    try {
      const result = await listMarketingDrafts();
      setDrafts((result.drafts || []) as MarketingDraft[]);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to load marketing drafts.");
    } finally {
      setDraftsLoading(false);
    }
  }

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("ai_discovered_events")
        .select("id, title, category, venue_name, price, currency, start_at, status, is_featured, image_url")
        .order("start_at", { ascending: true });

      if (error) {
        console.error("Error fetching studio events:", error.message);
        setErrorMsg(error.message);
      } else {
        setEvents((data || []) as EventItem[]);
      }
      setLoading(false);
    }

    fetchEvents();
    refreshDrafts();
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
        await refreshDrafts();
      } else {
        setErrorMsg(result.error || "Failed to generate draft.");
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "An unexpected error occurred.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleApprove = async (id: number) => {
    setActionId(id);
    setErrorMsg(null);
    try {
      await approveMarketingDraft(id);
      await refreshDrafts();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to approve draft.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionId(id);
    setErrorMsg(null);
    try {
      await rejectMarketingDraft(id);
      await refreshDrafts();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to reject draft.");
    } finally {
      setActionId(null);
    }
  };

  const approved = events.filter((event) => event.status === "approved");
  const needsReview = events.filter(
    (event) => event.status === "pending_review" || !event.status
  );
  const reviewDrafts = drafts.filter((draft) => draft.status === "draft");
  const approvedDrafts = drafts.filter((draft) => draft.status === "approved");

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
              Generate, review, approve and prepare promotional campaigns.
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

        <div className="mb-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center">
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

        <section className="mb-12 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold tracking-wide text-zinc-200">
              {"// MARKETING DRAFT REVIEW QUEUE"}
            </h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-400">
              {reviewDrafts.length} awaiting approval
            </span>
          </div>

          {draftsLoading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-16 text-center font-mono text-sm text-zinc-500">
              Loading campaign drafts...
            </div>
          ) : reviewDrafts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-16 text-center font-mono text-sm text-zinc-500">
              No marketing drafts awaiting approval.
            </div>
          ) : (
            <div className="space-y-6">
              {reviewDrafts.map((draft) => (
                <DraftReviewCard
                  key={draft.id}
                  draft={draft}
                  busy={actionId === draft.id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}

          {approvedDrafts.length > 0 && (
            <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
              <div className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                Approved / Ready to Publish: {approvedDrafts.length}
              </div>
              <div className="space-y-2">
                {approvedDrafts.map((draft) => (
                  <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div>
                      <span className="font-semibold text-white">{draft.event_name}</span>
                      <span className="ml-2 font-mono text-xs uppercase text-zinc-500">{draft.platform}</span>
                    </div>
                    <span className="font-mono text-xs text-emerald-400">READY TO PUBLISH</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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
                    <div>
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

function DraftReviewCard({
  draft,
  busy,
  onApprove,
  onReject,
}: {
  draft: MarketingDraft;
  busy: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="relative min-h-56 bg-zinc-900">
          {draft.image_url ? (
            <img src={draft.image_url} alt={draft.event_name} className="h-full min-h-56 w-full object-cover" />
          ) : draft.video_url ? (
            <video controls className="h-full min-h-56 w-full object-cover"><source src={draft.video_url} /></video>
          ) : (
            <div className="flex h-full min-h-56 items-center justify-center font-mono text-xs text-zinc-600">NO MEDIA ATTACHED</div>
          )}
        </div>
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-500 px-2 py-1 font-mono text-[10px] font-extrabold uppercase text-black">{draft.platform}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Draft #{draft.id}</span>
              </div>
              <h3 className="text-2xl font-bold">{draft.event_name}</h3>
              <p className="mt-1 font-mono text-xs text-zinc-500">{draft.city || "Location TBD"}</p>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase text-amber-400">
              Needs approval
            </span>
          </div>

          <div className="mt-6 whitespace-pre-wrap rounded-xl border border-zinc-900 bg-black p-5 font-mono text-xs leading-relaxed text-zinc-300">
            {draft.draft_content}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-5">
            <div className="font-mono text-[10px] text-zinc-500">
              {draft.image_url ? "IMAGE ATTACHED" : "NO IMAGE"}
              {draft.external_url ? " · EXPERIENCE LINK ATTACHED" : " · NO EXPERIENCE LINK"}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onReject(draft.id)}
                disabled={busy}
                className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-2.5 font-mono text-xs font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
              >
                {busy ? "Working..." : "Reject"}
              </button>
              <button
                type="button"
                onClick={() => onApprove(draft.id)}
                disabled={busy}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 font-mono text-xs font-extrabold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Approving..." : "Approve Campaign"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
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
