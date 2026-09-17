import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeTransferProviders } from "@/lib/integrations/transfers";
import { hotelbedsTransfersConfigured } from "@/lib/integrations/hotelbeds/transfers";
import { hotelbedsProductConfig } from "@/lib/integrations/hotelbeds/client";
import TransferProbe from "./TransferProbe";

export const dynamic = "force-dynamic";

export default async function TransferConnectivityPage() {
  await requireAdmin();
  const providers = await describeTransferProviders();
  const live = providers.filter((row) => row.contract_implemented && row.configured);
  const hotelbedsConfigured = hotelbedsTransfersConfigured();
  const hotelbedsConfig = hotelbedsProductConfig("transfers");

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">
          ← Integration Operations
        </Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Transfer connectivity
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Provider adapters</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Governed transfer supplier integrations. Credentials are never shown, supplier calls are explicit, and booking confirmation remains a controlled action.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard label="Configured providers" value={String(live.length)} note="Providers with implemented contracts and credentials" />
          <StatusCard label="Hotelbeds Transfers" value={hotelbedsConfigured ? "Configured" : "Missing"} note="Separate Transfers API credentials" />
          <StatusCard label="Environment" value={hotelbedsConfig.environment} note={hotelbedsConfig.baseUrl} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Hotelbeds Transfers workflow</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FlowStep step="1" title="Availability" note="GET simple route or POST multi-route availability" />
            <FlowStep step="2" title="Confirmation" note="POST /transfer-api/1.0/bookings with selected rateKey" />
            <FlowStep step="3" title="Post-booking" note="Retrieve booking details or simulate cancellation first" />
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            The server foundation already supports simple Availability, booking creation, booking retrieval and cancellation simulation. Verification controls cannot create a supplier booking.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Payment safety</p><h2 className="mt-2 text-lg font-bold">Confirmation reconciliation</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">Paid bookings with an indeterminate supplier confirmation are never retried automatically.</p></div>
            <Link href="/admin/integrations/transfers/reconciliation" className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300">Open reconciliation →</Link>
          </div>
        </section>

        <TransferProbe />

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Configured</th>
                <th className="p-4">Contract</th>
                <th className="p-4">Last error</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((row) => (
                <tr key={row.key} className="border-b border-zinc-900">
                  <td className="p-4 text-zinc-200">
                    {row.name}
                    <div className="font-mono text-[10px] text-zinc-500">{row.key}</div>
                  </td>
                  <td className="p-4 text-amber-400">{row.status}</td>
                  <td className="p-4 text-zinc-400">{row.configured ? "yes" : "no"}</td>
                  <td className="p-4 text-zinc-400">{row.contract_implemented ? "implemented" : "none"}</td>
                  <td className="max-w-sm p-4 text-zinc-500">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function StatusCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

function FlowStep({ step, title, note }: { step: string; title: string; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <p className="font-mono text-[10px] text-amber-400">STEP {step}</p>
      <p className="mt-2 font-semibold text-zinc-100">{title}</p>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}
