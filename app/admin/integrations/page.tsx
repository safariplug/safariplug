import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAurelianConfig } from "@/lib/integrations/aurelian";
import SyncButton from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAdmin();
  const config = getAurelianConfig();

  const { data: rows } = await supabaseAdmin
    .from("integration_syncs")
    .select(
      "id, provider, safariplug_event_id, external_id, sync_status, last_synced_at, last_error, last_payload"
    )
    .eq("provider", "aurelian")
    .order("updated_at", { ascending: false })
    .limit(25);

  const records = rows ?? [];

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/admin"
          className="font-mono text-xs text-amber-400 hover:underline"
        >
          ← Command Center
        </Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Partner integrations
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Aurelian Hospitality</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            SafariPlug remains the discovery source of truth. Aurelian can pull
            approved experiences from the existing inbound API. Outbound push
            waits for a documented Aurelian API contract.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="Inbound pull"
            value={
              config.inboundKeyConfigured ? "Key configured" : "Key missing"
            }
            note="/api/integrations/aurelian/events"
          />
          <StatusCard
            label="Outbound contract"
            value={config.outboundContractAvailable ? "Available" : "Required"}
            note={
              config.outboundBlockedReason ||
              "Documented Aurelian paths are present."
            }
          />
          <StatusCard
            label="Tracked records"
            value={String(records.length)}
            note="Latest 25 aurelian rows in integration_syncs"
          />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Manual inventory record</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Loads approved SafariPlug events, maps them to the Aurelian
            inventory payload, and writes sync tracking rows. It will not call
            a fake Aurelian URL.
          </p>
          <div className="mt-5">
            <SyncButton />
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left font-mono text-xs">
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
                    No integration rows yet.
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
                              row.safariplug_event_id
                          )
                        : row.safariplug_event_id}
                    </td>
                    <td className="p-4 text-amber-400">{row.sync_status}</td>
                    <td className="p-4 text-zinc-400">
                      {row.external_id || "—"}
                    </td>
                    <td className="max-w-xs p-4 text-zinc-500">
                      {row.last_error || "—"}
                    </td>
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
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}
