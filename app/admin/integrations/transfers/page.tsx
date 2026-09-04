import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeTransferProviders } from "@/lib/integrations/transfers";

export const dynamic = "force-dynamic";

export default async function TransferConnectivityPage() {
  await requireAdmin();
  const providers = await describeTransferProviders();
  const live = providers.filter((row) => row.contract_implemented && row.configured);

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">
          \u2190 Command Center
        </Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Transfer connectivity
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Provider adapters</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Architecture only. No transfer supplier is live. Credentials are never
            shown. Live search returns not-configured rather than fake vehicles.
          </p>
        </header>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Live suppliers
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-amber-400">{live.length}</p>
        </section>
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
                  <td className="p-4 text-zinc-400">
                    {row.contract_implemented ? "implemented" : "none"}
                  </td>
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
