import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeVerificationProviders } from "@/lib/integrations/verification";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hydrateVerificationStore } from "@/lib/services/verification-db";
import { toSafeEvidence } from "@/lib/services/verification";
import { CaseActions } from "./actions-client";
import { CreateCaseForm } from "./create-client";

export const dynamic = "force-dynamic";

export default async function VerificationTrustPage() {
  await requireAdmin();
  const providers = await describeVerificationProviders();
  const liveExternal = providers.filter(
    (row) => row.key !== "human_review" && row.contract_implemented && row.configured
  );
  const hydrated = await hydrateVerificationStore(supabaseAdmin);
  const cases = hydrated.ok ? hydrated.store.listCases() : [];
  const migrationPending = !hydrated.ok && hydrated.reason === "missing";

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">
          ← Command Center
        </Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Verification & trust
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Admin review</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Human review only. No identity, liveness, license, insurance, or
            background provider is connected. Approval cannot invent those
            checks. Evidence is private. Customers never see documents.
          </p>
        </header>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Live KYC providers
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-amber-400">
              {liveExternal.length}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Cases
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-amber-400">
              {cases.length}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Migration
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-amber-400">
              {migrationPending ? "pending" : "ready"}
            </p>
          </div>
        </section>
        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Contract</th>
                <th className="p-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((row) => (
                <tr key={row.key} className="border-b border-zinc-900">
                  <td className="p-4">{row.name}</td>
                  <td className="p-4 text-amber-400">{row.status}</td>
                  <td className="p-4 text-zinc-400">
                    {row.contract_implemented ? "implemented" : "none"}
                  </td>
                  <td className="max-w-sm p-4 text-zinc-500">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="space-y-4">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-zinc-400">
            Cases
          </h2>
          <CreateCaseForm />
          {cases.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-mono text-xs text-zinc-500">
              No verification cases. None are seeded. Create one through the
              admin API after the migration is applied.
            </p>
          ) : (
            cases.map((row) => {
              const evidence = hydrated.ok
                ? hydrated.store.listEvidence(row.id).map(toSafeEvidence)
                : [];
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                        {row.subject_type} · {row.verification_level}
                      </p>
                      <h3 className="mt-1 font-mono text-sm text-zinc-200">
                        {row.subject_id}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-amber-400">
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-zinc-500">
                    Provider {row.provider}
                    {row.reviewed_by ? ` · reviewer ${row.reviewed_by}` : ""}
                    {row.reviewed_at
                      ? ` · ${new Date(row.reviewed_at).toISOString()}`
                      : ""}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-zinc-500">
                    Evidence:{" "}
                    {evidence.length
                      ? evidence
                          .map((item) => `${item.evidence_type}:${item.status}`)
                          .join(", ")
                      : "none"}
                  </p>
                  <CaseActions id={row.id} status={row.status} />
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
