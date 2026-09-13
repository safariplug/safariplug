import Link from "next/link";
import ScoutButton from "./ScoutButton";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
    .select("id,location,category,status,queued_at,started_at,completed_at,attempt_count,max_attempts,last_error,events_found")
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
                <p className="mt-1 text-sm text-gray-600">Queued → Running → Completed/Failed. Stalled jobs retry automatically up to three attempts.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!queue?.length ? (
                <p className="text-sm text-gray-500">No queued Scout missions yet.</p>
              ) : (
                queue.map((job) => (
                  <div key={job.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{job.location} · {job.category}</p>
                        <p className="text-sm text-gray-500">Attempt {job.attempt_count}/{job.max_attempts}</p>
                      </div>
                      <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                        {job.status}
                      </span>
                    </div>
                    {job.last_error ? <p className="mt-2 text-sm text-red-600">{job.last_error}</p> : null}
                    {job.status === "completed" ? (
                      <p className="mt-2 text-sm text-gray-600">Worker finished this mission.</p>
                    ) : null}
                  </div>
                ))
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
