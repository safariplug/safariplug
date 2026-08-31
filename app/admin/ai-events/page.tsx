export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import AIEventFilter from "@/components/admin/AIEventFilter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { approveAIEvent } from "./actions/approve";
import { rejectAIEvent } from "./actions/reject";

const categories = [
  "All",
  "Music & Nightlife",
  "Food & Drink",
  "Beach",
  "Safari",
  "Adventure",
  "Culture",
  "Wellness",
];

function parseEventDate(date: string): Date {
  const trimmed = date.trim();

  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return new Date(trimmed);

  const [, year, month, day, hours, minutes, seconds = "00"] = match;

  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
}

function formatDate(date: string | null) {
  if (!date) return "Date TBA";

  const parsed = parseEventDate(date);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: 'Africa/Nairobi',
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatTime(date: string | null) {
  if (!date) return "Time TBA";

  const parsed = parseEventDate(date);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: 'Africa/Nairobi',
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function statusStyle(status: string | null) {
  if (status === "pending_review") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

function confidenceStyle(score: number | null) {
  if (score === null) {
    return "text-slate-400";
  }

  if (score >= 80) {
    return "text-emerald-600";
  }

  if (score >= 60) {
    return "text-orange-500";
  }

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

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(
  price: number | null,
  currency: string | null
) {
  if (price === null) return "Price TBA";

  if (Number(price) === 0) {
    return "Free";
  }

  return `${currency || "KES"} ${Number(price).toLocaleString()}`;
}

function isSuspiciousSource(
  sourceName: string | null,
  sourceUrl: string | null
) {
  const source = `${sourceName || ""} ${sourceUrl || ""}`.toLowerCase();

  return (
    source.includes("safariplug ai scout") ||
    source.includes("localhost") ||
    source.includes("example.com")
  );
}

export default async function AIEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "all";
  const { data: events, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .select(`
      id,
      title,
      description,
      category,
      city,
      venue_name,
      venue_address,
      start_at,
      end_at,
      price,
      currency,
      image_url,
      source_url,
      source_name,
      confidence_score,
      status,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
  console.error(
    "AI EVENTS PAGE ERROR:",
    JSON.stringify(error, null, 2)
  );
}

  const allEvents = events || [];

  const pendingEvents = allEvents.filter(
    (event) => event.status === "pending_review"
  );

  const approvedEvents = allEvents.filter(
    (event) => event.status === "approved"
  );

  const rejectedEvents = allEvents.filter(
    (event) => event.status === "rejected"
  );
const displayedEvents =
  tab === "pending"
    ? pendingEvents
    : tab === "approved"
    ? approvedEvents
    : tab === "rejected"
    ? rejectedEvents
    : allEvents;

  const realDiscoveries = allEvents.filter(
    (event) =>
      !isSuspiciousSource(event.source_name, event.source_url)
  );

  const withImages = realDiscoveries.filter(
    (event) => Boolean(event.image_url)
  );

  const imageCoverage =
    realDiscoveries.length > 0
      ? Math.round(
          (withImages.length / realDiscoveries.length) * 100
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-slate-950">

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">

          <div className="flex items-center gap-4">

            <Link
              href="/admin"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-sm"
            >
              S
            </Link>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
                SafariPlug Intelligence
              </p>

              <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                AI Events
              </h1>
            </div>

          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            <Link
              href="/admin/ai-scout"
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black transition hover:border-orange-300 hover:bg-orange-50 sm:px-5 sm:text-sm"
            >
              AI Scout
            </Link>

            <Link
              href="/events"
                            className="rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-orange-500 sm:px-5 sm:text-sm"
            >
              View Events
            </Link>

          </div>

        </div>
      </header>


      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">

        {/* HERO */}

        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">

          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />

          <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-orange-400/10 blur-3xl" />

          <div className="relative">

            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">

              <span className="h-2 w-2 rounded-full bg-orange-400" />

              AI Discovery Pipeline

            </div>

            <div className="mt-6 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">

              <div className="max-w-3xl">

                <h2 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  Discover what is
                  <span className="block text-orange-400">
                    happening next.
                  </span>
                </h2>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                  SafariPlug AI scans East Africa for real events,
                  experiences and hidden gems. Review the evidence,
                  verify the details and approve only the experiences
                  worth publishing.
                </p>

              </div>

              <Link
                href="/admin/ai-scout"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500 px-7 py-4 text-sm font-black text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-400"
              >
                Run AI Scout →
              </Link>

            </div>

          </div>

        </section>


        {/* STATS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Total Discoveries"
            value={allEvents.length}
            description="AI discoveries"
          />

          <StatCard
            label="Needs Review"
            value={pendingEvents.length}
            description="Awaiting approval"
            accent
          />

          <StatCard
            label="Published"
            value={approvedEvents.length}
            description="Live on SafariPlug"
            success
          />

          <StatCard
            label="Image Coverage"
            value={`${imageCoverage}%`}
            description={`${withImages.length} discoveries have images`}
          />

        </section>


        {/* INBOX HEADER */}

        <section className="mt-10">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
                Discovery inbox
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Review events
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Check the source, event details, image and confidence
                before publishing anything to SafariPlug.
              </p>

            </div>

            <div className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-500 shadow-sm ring-1 ring-slate-200">
              {pendingEvents.length} waiting for review
            </div>
<div className="flex flex-wrap gap-3 mt-5">

  <Link
    href="/admin/ai-events"
    className="rounded-full bg-slate-950 px-5 py-2 text-xs font-black text-white"
  >
    All ({allEvents.length})
  </Link>

  <Link
    href="/admin/ai-events?tab=pending"
    className="rounded-full bg-orange-500 px-5 py-2 text-xs font-black text-white"
  >
    Needs Review ({pendingEvents.length})
  </Link>

  <Link
    href="/admin/ai-events?tab=approved"
    className="rounded-full bg-green-600 px-5 py-2 text-xs font-black text-white"
  >
    Published ({approvedEvents.length})
  </Link>

  <Link
    href="/admin/ai-events?tab=rejected"
    className="rounded-full bg-red-600 px-5 py-2 text-xs font-black text-white"
  >
    Rejected ({rejectedEvents.length})
  </Link>

</div>

          </div>

</section>


          


        {/* EVENTS */}

        <section className="mt-6">

          {allEvents.length === 0 ? (

            <EmptyState />

          ) : (

            <div className="space-y-5">

              {displayedEvents.map((event) => {

                const suspicious = isSuspiciousSource(
                  event.source_name,
                  event.source_url
                );

                return (

                  <article
                    key={event.id}
                    className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                  >

                    <div className="grid lg:grid-cols-[280px_1fr_auto]">

                      {/* IMAGE */}

                      <div className="relative min-h-[230px] overflow-hidden bg-slate-950">

                        {event.image_url ? (

                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />

                        ) : (

                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-800 to-orange-600">

                            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />

                            <div className="relative text-center text-white">

                              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 text-3xl font-black">
                                S
                              </div>

                              <p className="mt-4 text-[9px] font-black uppercase tracking-[0.22em] text-white/50">
                                Image pending
                              </p>

                            </div>

                          </div>

                        )}

                        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />

                        <div className="absolute left-4 top-4">

                          <span
                            className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${statusStyle(
                              event.status
                            )}`}
                          >
                            {formatStatus(event.status)}
                          </span>

                        </div>

                        {event.image_url && (
                          <div className="absolute bottom-4 left-4">

                            <span className="rounded-full bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                              Image found
                            </span>

                          </div>
                        )}

                      </div>


                      {/* CONTENT */}

                      <div className="p-6 sm:p-7">

                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                {event.category || "Uncategorized"}
                              </span>

                              {event.city && (
                                <span className="text-xs font-bold text-slate-400">
                                  {event.city}
                                </span>
                              )}

                            </div>

                            <h3 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                              {event.title}
                            </h3>

                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                              {event.description ||
                                "No description available."}
                            </p>

                          </div>


                          {/* CONFIDENCE */}

                          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:min-w-[112px]">

                            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Confidence
                            </div>

                            <div
                              className={`mt-1 text-2xl font-black ${confidenceStyle(
                                event.confidence_score
                              )}`}
                            >
                              {event.confidence_score ?? "—"}%
                            </div>

                            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              {confidenceLabel(
  event.confidence_score
)}
                            </div>

                          </div>

                        </div>


                        {/* EVENT META */}

                        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">

                          <MetaItem
                            label="When"
                            value={
                              event.start_at
                                ? `${formatDate(event.start_at)} · ${formatTime(event.start_at)}${event.end_at ? `–${formatTime(event.end_at)}` : ""}`
                                : "Date TBA"
                            }
                          />

                          <MetaItem
                            label="Venue"
                            value={
                              event.venue_name ||
                              "Venue TBA"
                            }
                          />

                          <MetaItem
                            label="Price"
                            value={formatPrice(
                              event.price,
                              event.currency
                            )}
                          />

                        </div>


                        {/* SOURCE */}

                        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">

                          <div>

                            <span className="text-slate-400">
                              Source
                            </span>

                            <span className="ml-2 font-black text-slate-700">
                              {event.source_name ||
                                "Unknown"}
                            </span>

                            {suspicious && (
                              <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-600">
                                Verify source
                              </span>
                            )}

                          </div>

                          {event.source_url && (
                            <a
                              href={event.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-black text-orange-500 transition hover:text-orange-600"
                            >
                              View source →
                            </a>
                          )}

                        </div>

                      </div>


                      {/* ACTIONS */}

                      <div className="flex flex-col justify-center gap-3 border-t border-slate-100 bg-slate-50 p-5 lg:min-w-[190px] lg:border-l lg:border-t-0">

                        <Link
                          href={`/admin/ai-events/edit/${event.id}`}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          Review / Edit
                        </Link>


                        {event.status === "pending_review" && (
                          <form
                            action={approveAIEvent.bind(
                              null,
                              event.id
                            )}
                          >
                            <button
                              type="submit"
                              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                            >
                              Approve & Publish
                            </button>
                          </form>
                        )}
{event.status === "pending_review" && (
  <form
    action={rejectAIEvent.bind(
      null,
      event.id
    )}
  >
    <button
      type="submit"
      className="w-full rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-black text-red-600 transition hover:bg-red-50"
    >
      Reject
    </button>
  </form>
)}


                        {event.status === "approved" && (
                          <Link
                            href="/events"
                            target="_blank"
                            className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-orange-500"
                          >
                            View Live Events
                          </Link>
                        )}

                      </div>

                    </div>

                  </article>

                );
              })}

            </div>

          )}

        </section>


        {/* PIPELINE */}

        <section className="mt-14 rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
              How it works
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              SafariPlug discovery pipeline
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              AI discovers. Evidence verifies. You decide what becomes
              part of the SafariPlug experience.
            </p>

          </div>


          <div className="mt-8 grid gap-4 md:grid-cols-4">

            <PipelineStep
              number="01"
              title="Discover"
              text="AI searches the live web for real upcoming experiences."
            />

            <PipelineStep
              number="02"
              title="Verify"
              text="Review the source, date, venue, price and confidence."
            />

            <PipelineStep
              number="03"
              title="Approve"
              text="Human approval controls what enters the platform."
            />

            <PipelineStep
              number="04"
              title="Publish"
              text="Approved experiences become visible on SafariPlug."
            />

          </div>

        </section>

      </div>

    </main>
  );
}


function StatCard({
  label,
  value,
  description,
  accent,
  success,
}: {
  label: string;
  value: number | string;
  description: string;
  accent?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        {accent && (
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
        )}

        {success && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        )}

      </div>

      <p
        className={`mt-4 text-4xl font-black ${
          accent
            ? "text-orange-500"
            : success
            ? "text-emerald-600"
            : "text-slate-950"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-400">
        {description}
      </p>

    </div>
  );
}


function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-black leading-5 text-slate-700">
        {value}
      </p>

    </div>
  );
}


function PipelineStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <div className="text-xs font-black text-orange-500">
        {number}
      </div>

      <h3 className="mt-3 font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {text}
      </p>

    </div>
  );
}


function EmptyState() {
  return (
    <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-16 text-center">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-2xl font-black text-white">
        S
      </div>

      <h3 className="mt-6 text-2xl font-black">
        No AI discoveries yet
      </h3>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
        Run the AI Scout to start discovering events and
        experiences across East Africa.
      </p>

      <Link
        href="/admin/ai-scout"
        className="mt-7 inline-flex rounded-full bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-400"
      >
        Run AI Scout →
      </Link>

    </div>
  );
}



