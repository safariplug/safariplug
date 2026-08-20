import { runAIScout } from "./actions/run-scout";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

const locations = [
  "Mombasa",
  "Diani",
  "Kilifi",
  "Malindi",
  "Nairobi",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam",
];

const categories = [
  "Music & Nightlife",
  "Food & Drink",
  "Beach",
  "Safari",
  "Adventure",
  "Culture",
  "Wellness",
];

async function getScoutStats() {
  const { data: latestRun } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id, location, category, events_found, status, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: waitingReview } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  return {
    latestRun,
    waitingReview: waitingReview ?? 0,
  };
}

function formatScanDate(date: string | null | undefined) {
  if (!date) return "Not Started";

  return new Date(date).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AIScoutPage() {
  const { latestRun, waitingReview } = await getScoutStats();

  const eventsFound = latestRun?.events_found ?? 0;

  const scanStatus = latestRun?.status ?? "not_started";

  return (
    <main className="min-h-screen bg-[#fffaf5] p-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-orange-500">
              SafariPlug Intelligence
            </p>

            <h1 className="mt-3 text-5xl font-black">
              AI Event Scout
            </h1>

            <p className="mt-3 max-w-xl text-slate-500">
              Discover events, experiences and hidden gems across East Africa
              before they appear on SafariPlug.
            </p>
          </div>

          <Link
            href="/admin/ai-events"
            className="rounded-full bg-slate-950 px-7 py-3 font-black text-white"
          >
            Review Discoveries →
          </Link>
        </div>

        {/* Scout Form */}
        <section className="mt-10 rounded-[32px] bg-white p-8 shadow">
          <h2 className="text-3xl font-black">
            Start Discovery Scan
          </h2>

          <p className="mt-2 text-slate-500">
            Choose where the AI should search.
          </p>

          <form
            action={runAIScout}
            className="mt-8 grid gap-5 md:grid-cols-3"
          >
            <div>
              <label className="mb-2 block text-sm font-black">
                Location
              </label>

              <select
                name="location"
                className="w-full rounded-xl border px-4 py-3 font-bold"
                defaultValue="Mombasa"
              >
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                Category
              </label>

              <select
                name="category"
                className="w-full rounded-xl border px-4 py-3 font-bold"
                defaultValue="Music & Nightlife"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-orange-500 px-6 py-3 font-black text-white hover:bg-orange-600"
              >
                🔎 Run AI Scout
              </button>
            </div>
          </form>
        </section>

        {/* Statistics */}
        <section className="mt-10 grid gap-6 md:grid-cols-3">

          {/* Last Scan */}
          <div className="rounded-3xl bg-white p-6 shadow">
            <p className="text-sm font-bold text-slate-400">
              Last Scan
            </p>

            <p className="mt-3 text-2xl font-black">
              {latestRun
                ? formatScanDate(latestRun.created_at)
                : "Not Started"}
            </p>

            {latestRun && (
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    scanStatus === "completed"
                      ? "bg-green-500"
                      : scanStatus === "running"
                      ? "bg-orange-500"
                      : scanStatus === "failed"
                      ? "bg-red-500"
                      : "bg-slate-400"
                  }`}
                />

                <span className="text-sm font-bold capitalize text-slate-500">
                  {scanStatus}
                </span>
              </div>
            )}

            {latestRun && (
              <p className="mt-2 text-xs text-slate-400">
                {latestRun.location} · {latestRun.category}
              </p>
            )}
          </div>

          {/* Events Found */}
          <div className="rounded-3xl bg-white p-6 shadow">
            <p className="text-sm font-bold text-slate-400">
              Events Found
            </p>

            <p className="mt-3 text-4xl font-black">
              {eventsFound}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              From the latest Scout scan
            </p>
          </div>

          {/* Waiting Review */}
          <div className="rounded-3xl bg-white p-6 shadow">
            <p className="text-sm font-bold text-slate-400">
              Waiting Review
            </p>

            <p className="mt-3 text-4xl font-black">
              {waitingReview}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              AI discoveries awaiting approval
            </p>
          </div>
        </section>

        {/* Latest Run Details */}
        {latestRun && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
                  Latest Scout Run
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {latestRun.location} · {latestRun.category}
                </h2>
              </div>

              <div className="text-left md:text-right">
                <p className="text-sm text-slate-400">
                  Completed
                </p>

                <p className="font-bold">
                  {latestRun.completed_at
                    ? formatScanDate(latestRun.completed_at)
                    : "Still running"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Roadmap */}
        <section className="mt-10 rounded-3xl bg-slate-950 p-8 text-white">
          <h2 className="text-3xl font-black">
            AI Scout Roadmap
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">
                1. Discover
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Find events and experiences.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">
                2. Verify
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Score quality and reliability.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">
                3. Prepare
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Generate descriptions and content.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">
                4. Publish
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Human approval first.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}