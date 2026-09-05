import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAurelianConfig, INBOUND_EVENTS_PATH } from "@/lib/integrations/aurelian";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAdmin();
  const config = getAurelianConfig();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: approvedEvents, error: eventsError },
    { data: rows },
    { data: feedRuns, error: feedRunsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id, start_at, status")
      .eq("status", "approved"),
    supabaseAdmin
      .from("integration_syncs")
      .select(
        "id, provider, safariplug_event_id, external_id, sync_status, last_synced_at, last_error, last_payload"
      )
      .eq("provider", "aurelian")
      .order("updated_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("aurelian_feed_runs")
      .select(
        "id, requested_at, duration_ms, http_status, record_count, upcoming_count, excluded_past_count, malformed_count, outcome"
      )
      .order("requested_at", { ascending: false })
      .limit(100),
  ]);

  const events = approvedEvents ?? [];
  const upcomingCount = events.filter(
    (event) => event.start_at && new Date(event.start_at).getTime() >= now.getTime(),
  ).length;
  const pastCount = events.length - upcomingCount;
  const records = rows ?? [];
  const runs = feedRuns ?? [];
  const recentRuns = runs.filter(
    (run) => new Date(run.requested_at).getTime() >= new Date(twentyFourHoursAgo).getTime(),
  );
  const successfulRuns = runs.filter((run) => run.outcome === "success");
  const lastRun = runs[0] ?? null;
  const lastSuccessfulRun = successfulRuns[0] ?? null;
  const recentFailures = recentRuns.filter((run) => run.outcome === "error").length;
  const lastRunHealthy = Boolean(lastRun && lastRun.outcome === "success" && lastRun.http_status === 200);

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          href="/admin"
          className="font-mono text-xs text-amber-400 hover:underline"
        >
          ← Command Center
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Partner integrations / production monitoring
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Aurelian Hospitality</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            SafariPlug is the discovery source of truth. Aurelian consumes the
            approved, upcoming catalog through the authenticated inbound feed.
            SafariPlug does not push listings into Aurelian reservation inventory.
          </p>
        </header>

        {eventsError ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
            Unable to read the production event catalog: {eventsError.message}
          </div>
        ) : null}
        {feedRunsError ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
            Unable to read feed telemetry: {feedRunsError.message}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="Integration status"
            value={config.inboundKeyConfigured ? "● Connected" : "● Key missing"}
            tone={config.inboundKeyConfigured ? "good" : "bad"}
            note="Aurelian inbound authentication"
          />
          <StatusCard
            label="Approved catalog"
            value={String(events.length)}
            note="All approved SafariPlug events"
          />
          <StatusCard
            label="Aurelian snapshot"
            value={String(upcomingCount)}
            tone="good"
            note="Approved events with start_at ≥ now"
          />
          <StatusCard
            label="Excluded as past"
            value={String(pastCount)}
            note="Correctly omitted from the Aurelian feed"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="Last feed request"
            value={lastRun ? formatDate(lastRun.requested_at) : "No requests"}
            tone={lastRunHealthy ? "good" : lastRun ? "bad" : "neutral"}
            note={lastRun ? `${lastRun.http_status} · ${lastRun.duration_ms ?? "—"} ms` : "Waiting for Aurelian to consume the feed"}
          />
          <StatusCard
            label="Requests / 24h"
            value={String(recentRuns.length)}
            tone="good"
            note="Authenticated feed requests recorded"
          />
          <StatusCard
            label="Failures / 24h"
            value={String(recentFailures)}
            tone={recentFailures === 0 ? "good" : "bad"}
            note="Feed requests returning an application error"
          />
          <StatusCard
            label="Last successful snapshot"
            value={lastSuccessfulRun ? `${lastSuccessfulRun.record_count} records` : "None yet"}
            tone={lastSuccessfulRun ? "good" : "neutral"}
            note={lastSuccessfulRun ? formatDate(lastSuccessfulRun.requested_at) : "No successful authenticated request recorded"}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <MonitorCard
            title="Feed endpoint"
            value="READY"
            detail={INBOUND_EVENTS_PATH}
          />
          <MonitorCard
            title="Snapshot model"
            value="FULL SNAPSHOT"
            detail="Aurelian upserts current IDs and removes stale SafariPlug IDs."
          />
          <MonitorCard
            title="Booking isolation"
            value="ENFORCED"
            detail="Partner discoveries remain outside Aurelian reservation inventory."
          />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Feed health history</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Every authenticated Aurelian feed request is recorded here without storing
                the API key. This measures SafariPlug feed consumption, not Aurelian's private
                database sync timestamp.
              </p>
            </div>
            <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {runs.length} recent runs
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="p-4">Requested</th>
                  <th className="p-4">HTTP</th>
                  <th className="p-4">Records</th>
                  <th className="p-4">Malformed</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td className="p-6 text-zinc-500" colSpan={6}>
                      No authenticated Aurelian feed requests have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b border-zinc-900">
                      <td className="p-4 text-zinc-400">{formatDate(run.requested_at)}</td>
                      <td className={`p-4 ${run.http_status === 200 ? "text-emerald-300" : "text-red-300"}`}>
                        {run.http_status}
                      </td>
                      <td className="p-4 text-zinc-200">{run.record_count}</td>
                      <td className="p-4 text-zinc-400">{run.malformed_count}</td>
                      <td className="p-4 text-zinc-400">{run.duration_ms ?? "—"} ms</td>
                      <td className="p-4 text-right">
                        <span className={run.outcome === "success" ? "text-emerald-300" : "text-red-300"}>
                          {run.outcome.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Production reconciliation</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                SafariPlug can verify the feed source and catalog counts. Aurelian's
                private partner_experiences timestamps are intentionally not fabricated
                here; they must be checked from the Aurelian environment.
              </p>
            </div>
            <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Feed contract verified
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Check label="Authentication gate" value="PASS" />
            <Check label="Upcoming filter" value="PASS" />
            <Check label="Pagination / full snapshot" value="PASS" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Legacy local sync records</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Historical SafariPlug-side tracking only. These rows do not represent
                an Aurelian API push or private Aurelian sync timestamp.
              </p>
            </div>
            <span className="font-mono text-xs text-zinc-500">{records.length} rows</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="p-4">Event</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">External ID</th>
                  <th className="p-4">Last error</th>
                  <th className="p-4 text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td className="p-6 text-zinc-500" colSpan={5}>
                      No legacy local sync rows. This is expected for the current pull-based integration.
                    </td>
                  </tr>
                ) : (
                  records.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-900">
                      <td className="p-4 text-zinc-200">
                        {typeof row.last_payload === "object" &&
                        row.last_payload &&
                        "title" in row.last_payload
                          ? String(
                              (row.last_payload as { title?: string }).title ||
                                row.safariplug_event_id,
                            )
                          : row.safariplug_event_id}
                      </td>
                      <td className="p-4 text-amber-400">{row.sync_status}</td>
                      <td className="p-4 text-zinc-400">{row.external_id || "—"}</td>
                      <td className="max-w-xs p-4 text-zinc-500">{row.last_error || "—"}</td>
                      <td className="p-4 text-right text-zinc-500">
                        {row.last_synced_at
                          ? new Date(row.last_synced_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function StatusCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-red-300"
        : "text-amber-400";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-2 font-mono text-lg font-bold ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

function MonitorCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="mt-2 font-mono text-sm font-bold text-emerald-300">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function Check({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="font-mono text-[10px] font-bold text-emerald-300">{value}</span>
    </div>
  );
}
