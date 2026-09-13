import Link from "next/link";
import ScoutButton from "./ScoutButton";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScoutQueueJob = {
  id: string;
  location: string;
  category: string;
  status: string;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  events_found: number | null;
  discoveries_found: number | null;
  sent_for_review: number | null;
  worker_stage: string | null;
  provider_status: string | null;
  notes: string | null;
};

function stageLabel(job: ScoutQueueJob) {
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return "Failed";
  if (job.status === "queued") return "Queued";
  if (job.worker_stage === "awaiting_openai") {
    if (job.provider_status === "queued") return "AI Search Queued";
    if (job.provider_status === "in_progress") return "Searching with AI";
    return "Waiting for AI";
  }
  if (job.worker_stage === "finalizing") return "Verifying Sources";
  return job.status === "running" ? "Starting Worker" : job.status;
}

function stageDetail(job: ScoutQueueJob) {
  if (job.status === "completed") {
    return `${job.discoveries_found ?? 0} candidates · ${job.sent_for_review ?? job.events_found ?? 0} sent for review`;
  }

  if (job.status === "queued") {
    return "Waiting for the next worker slot.";
  }

  if (job.worker_stage === "awaiting_openai") {
    return job.provider_status
      ? `OpenAI background search: ${job.provider_status.replaceAll("_", " ")}.`
      : "OpenAI background search is active.";
  }

  if (job.worker_stage === "finalizing") {
    return "AI search completed. SafariPlug is verifying sources and saving qualified discoveries.";
  }

  if (job.status === "failed") return job.last_error || "Scout mission failed.";
  return job.notes || null;
}

export default async function AIScoutPage() {
  const { count: total } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true });

  const { count: pending } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");

  const { count: approved } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const { data: discoveries } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("id, title, city, venue_name, category, confidence_score, status, review_status")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: queue } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id,location,category,status,queued_at,started_at,completed_at,attempt_count,max_attempts,last_error,events_found,discoveries_found,sent_for_review,worker_stage,provider_status,notes")
    .not("queued_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← Back to Admin
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold">SafariPlug AI Scout</h1>
          <p className="mt-2 text-gray-600">Discovery intelligence engine monitoring Africa experiences.</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-5">
              <p>Discoveries</p>
              <p className="text-3xl font-bold">{total ?? 0}</p>
            </div>
            <div className="rounded-xl border p-5">
              <p>Pending Review</p>
              <p className="text-3xl font-bold">{pending ?? 0}</p>
            </div>
            <div className="rounded-xl border p-5">
              <p>Approved</p>
              <p className="text-3xl font-bold">{approved ?? 0}</p>
            </div>
          </div>

          <section className="mt-10 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Scout Mission Control</h2>
            <p className="mt-2 text-gray-600">Queue discovery missions by destination. The worker processes them independently of your browser request.</p>
            <ScoutButton />
          </section>

          <section className="mt-10 rounded-xl border p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Scout Queue</h2>
                <p className="mt-1 text-sm text-gray-600">Queued → Searching with AI → Verifying Sources → Completed/Failed. Stalled jobs retry automatically up to three attempts.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!queue?.length ? (
                <p className="text-sm text-gray-500">No queued Scout missions yet.</p>
              ) : (
                (queue as ScoutQueueJob[]).map((job) => {
                  const detail = stageDetail(job);
                  const showError = job.status === "failed" && job.last_error;

                  return (
                    <div key={job.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{job.location} · {job.category}</p>
                          <p className="text-sm text-gray-500">Attempt {job.attempt_count}/{job.max_attempts}</p>
                        </div>
                        <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                          {stageLabel(job)}
                        </span>
                      </div>

                      {detail ? <p className="mt-2 text-sm text-gray-600">{detail}</p> : null}
                      {showError ? <p className="mt-2 text-sm text-red-600">{job.last_error}</p> : null}

                      {job.status === "completed" ? (
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>Candidates: <strong>{job.discoveries_found ?? 0}</strong></span>
                          <span>Sent for review: <strong>{job.sent_for_review ?? job.events_found ?? 0}</strong></span>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="mt-10 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Discovery Feed</h2>
            <div className="mt-5 space-y-4">
              {discoveries?.map((event) => (
                <div key={event.id} className="rounded-xl border p-4">
                  <h3 className="font-bold">{event.title}</h3>
                  <p className="text-sm text-gray-600">{event.city} · {event.venue_name}</p>
                  <p className="text-sm">{event.category}</p>
                  <p className="text-sm">Confidence: {event.confidence_score}%</p>
                  <p className="text-sm">Status: {event.status}</p>
                  <p className="text-sm">Review: {event.review_status}</p>

                  <div className="mt-4 flex gap-3">
                    {event.status === "pending_review" && (
                      <Link href={`/admin/ai-events/edit/${event.id}`} className="rounded-lg bg-orange-500 px-4 py-2 text-white">
                        Preview & Verify
                      </Link>
                    )}

                    {event.status === "approved" && (
                      <form action={`/api/admin/scout/publish/${event.id}`} method="POST">
                        <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">Publish to SafariPlug</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
