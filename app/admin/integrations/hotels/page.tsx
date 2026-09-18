import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeHotelProviders } from "@/lib/integrations/hotels";

export const dynamic = "force-dynamic";

const priorityKeys = ["ratehawk", "beds24", "booking"] as const;

export default async function HotelConnectivityPage() {
  await requireAdmin();
  const providers = await describeHotelProviders();
  const live = providers.filter((row) => row.contract_implemented && row.configured);
  const implemented = providers.filter((row) => row.contract_implemented);
  const priority = priorityKeys
    .map((key) => providers.find((row) => row.key === key))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">
          ← Integration Operations
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Hotel connectivity
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Provider readiness center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            SafariPlug keeps hotel suppliers behind explicit adapters and server-only credentials. A provider is not treated as live merely because credentials exist.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard label="Registered adapters" value={String(implemented.length)} note="Supplier contracts implemented in code" />
          <StatusCard label="Configured + implemented" value={String(live.length)} note="Eligible for controlled use, subject to supplier readiness" />
          <StatusCard label="Priority onboarding" value={String(priority.length)} note="RateHawk, Beds24 and Booking.com tracked separately" />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Priority provider onboarding</p>
              <h2 className="mt-2 text-xl font-bold">Next hotel connections</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                These cards are local readiness only. They do not call supplier APIs and do not assume the supplier has approved SafariPlug.
              </p>
            </div>
            <Link href="/hotels" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300">
              Open public hotels →
            </Link>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {priority.map((row) => (
              <ProviderReadinessCard
                key={row.key}
                name={row.name}
                keyName={row.key}
                configured={row.configured}
                implemented={row.contract_implemented}
                status={row.status}
                reason={row.reason}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Activation rules</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Rule title="1 · Supplier approval" body="Commercial/API access must be approved by the provider before SafariPlug claims a live connection." />
            <Rule title="2 · Adapter contract" body="Search, availability, quote, confirmation and post-booking behavior must be implemented and tested for that provider." />
            <Rule title="3 · Controlled verification" body="Credentials are added server-side, then SafariPlug runs explicit test calls. No background verification or fake inventory." />
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Configured</th>
                <th className="p-4">Contract</th>
                <th className="p-4">Capabilities</th>
                <th className="p-4">Reason / next gate</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((row) => {
                const caps = Object.entries(row.capabilities)
                  .filter(([, enabled]) => enabled)
                  .map(([name]) => name)
                  .join(", ");
                return (
                  <tr key={row.key} className="border-b border-zinc-900 align-top">
                    <td className="p-4 text-zinc-200">
                      {row.name}
                      <div className="font-mono text-[10px] text-zinc-500">{row.key}</div>
                    </td>
                    <td className="p-4 text-amber-400">{row.status}</td>
                    <td className="p-4 text-zinc-400">{row.configured ? "yes" : "no"}</td>
                    <td className="p-4 text-zinc-400">{row.contract_implemented ? "implemented" : "not implemented"}</td>
                    <td className="p-4 text-zinc-500">{caps || "none"}</td>
                    <td className="max-w-md p-4 text-zinc-500">{row.reason}</td>
                  </tr>
                );
              })}
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

function ProviderReadinessCard({
  name,
  keyName,
  configured,
  implemented,
  status,
  reason,
}: {
  name: string;
  keyName: string;
  configured: boolean;
  implemented: boolean;
  status: string;
  reason: string | null;
}) {
  const prefix = `SAFARIPLUG_HOTEL_${keyName.toUpperCase()}`;
  return (
    <article className="rounded-2xl border border-zinc-800 bg-black p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-100">{name}</h3>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">{keyName}</p>
        </div>
        <span className="rounded-full border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-300">
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-zinc-950 p-3">
          <p className="text-zinc-600">Credentials</p>
          <p className="mt-1 font-semibold text-zinc-300">{configured ? "Present" : "Not present"}</p>
        </div>
        <div className="rounded-xl bg-zinc-950 p-3">
          <p className="text-zinc-600">API contract</p>
          <p className="mt-1 font-semibold text-zinc-300">{implemented ? "Implemented" : "Pending"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-900 p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">SafariPlug placeholder config</p>
        <p className="mt-2 font-mono text-[10px] leading-5 text-zinc-500">{prefix}_BASE_URL</p>
        <p className="font-mono text-[10px] leading-5 text-zinc-500">{prefix}_API_KEY</p>
        <p className="mt-2 text-[10px] leading-4 text-zinc-600">
          Actual supplier authentication may require additional fields when the provider contract is implemented.
        </p>
      </div>

      <p className="mt-4 text-xs leading-5 text-zinc-500">{reason || "Awaiting provider-specific implementation."}</p>
    </article>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <p className="font-semibold text-zinc-200">{title}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{body}</p>
    </div>
  );
}
