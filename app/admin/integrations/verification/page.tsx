import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeVerificationProviders } from "@/lib/integrations/verification";
import { sumsubConfigurationStatus } from "@/lib/integrations/verification/sumsub";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hydrateVerificationStore } from "@/lib/services/verification-db";
import { toSafeEvidence } from "@/lib/services/verification";
import { CaseActions } from "./actions-client";
import { CreateCaseForm } from "./create-client";

export const dynamic = "force-dynamic";

function tone(status: string) {
  if (status === "approved") return "text-emerald-300";
  if (["rejected", "revoked", "expired"].includes(status)) return "text-red-300";
  return "text-amber-300";
}

export default async function VerificationTrustPage() {
  await requireAdmin();

  const providers = await describeVerificationProviders();
  const hydrated = await hydrateVerificationStore(supabaseAdmin);
  const cases = hydrated.ok ? hydrated.store.listCases() : [];
  const travelerCases = cases.filter((row) => row.subject_type === "traveler");
  const travelerPending = travelerCases.filter((row) =>
    ["not_started", "pending", "in_review"].includes(row.status)
  ).length;
  const driverCases = cases.filter((row) => row.subject_type === "driver");
  const localCases = cases.filter((row) => row.subject_type === "local");
  const specialistCases = cases.filter((row) => row.subject_type === "service_staff");
  const specialistApproved = specialistCases.filter((row) => row.status === "approved").length;
  const specialistPending = specialistCases.filter((row) =>
    ["not_started", "pending", "in_review"].includes(row.status)
  ).length;

  const sumsubConfig = sumsubConfigurationStatus();
  const identity = providers.find((row) => row.key === "identity_provider");
  const liveness = providers.find((row) => row.key === "liveness_provider");
  const sumsubReady = Boolean(
    identity?.contract_implemented &&
      identity?.configured &&
      liveness?.contract_implemented &&
      liveness?.configured
  );

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">
          ← Command Center
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Verification & trust
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Trust operations center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Monitor identity, live face/liveness and other verification cases across travelers,
            drivers, Locals, individual service specialists and providers. External Sumsub decisions are provider-managed:
            SafariPlug staff can revoke an approved case for safety, but cannot manually invent
            identity or liveness approval.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric label="Traveler cases" value={String(travelerCases.length)} />
          <Metric label="Traveler pending" value={String(travelerPending)} />
          <Metric label="Driver cases" value={String(driverCases.length)} />
          <Metric label="Local cases" value={String(localCases.length)} />
          <Metric label="Specialists approved" value={String(specialistApproved)} />
          <Metric label="Specialists pending" value={String(specialistPending)} />
          <Metric label="Identity + liveness" value={sumsubReady ? "connected" : "not ready"} />
        </section>

        <section className={`rounded-2xl border p-6 ${sumsubReady ? "border-emerald-900/60 bg-emerald-950/10" : "border-amber-900/60 bg-amber-950/10"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Marketplace trust gates
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {sumsubReady
                  ? "Identity + live face verification adapter is configured"
                  : "Traveler trust-sensitive bookings remain blocked until verification is configured"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Travelers must be verified for trust-sensitive bookings. Drivers, Locals and each
                specific service specialist must also have their own approved identity + live face/liveness
                result before they can be represented as verified or bookable.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/account/verification" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300">Traveler verification →</Link>
              <Link href="/business/services/identity" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300">Service specialist identity →</Link>
              <Link href="/admin/integrations/drivers" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300">Driver readiness →</Link>
              <Link href="/admin/integrations/locals" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300">Local readiness →</Link>
            </div>
          </div>
        </section>

        {!sumsubReady ? (
          <section className="rounded-2xl border border-red-900/60 bg-red-950/10 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-red-300/70">Production setup required</p>
            <h2 className="mt-2 text-xl font-bold">Sumsub is not fully configured in this runtime</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              SafariPlug will keep identity/liveness gates blocked until the external provider is configured. Values are never shown here; only missing variable names are listed.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Missing configuration</p>
                <div className="mt-3 space-y-1 font-mono text-xs text-red-300">
                  {sumsubConfig.missing.length ? sumsubConfig.missing.map((name) => <p key={name}>{name}</p>) : <p className="text-emerald-300">All required variables are present.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Production webhook URL</p>
                <p className="mt-3 break-all font-mono text-xs text-zinc-300">{sumsubConfig.webhookUrl}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Configure this in Sumsub with HMAC SHA-256 and use the same secret as SUMSUB_WEBHOOK_SECRET.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/integrations/verification" className="text-xs font-semibold text-amber-400">Refresh readiness after configuration →</Link>
            </div>
          </section>
        ) : null}

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="font-semibold">Verification provider readiness</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Configuration status only. This screen does not run external verification calls.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="p-4">Capability</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Configured</th>
                <th className="p-4">Contract</th>
                <th className="p-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((row) => (
                <tr key={row.key} className="border-b border-zinc-900 align-top">
                  <td className="p-4 font-mono text-xs text-zinc-400">
                    {row.key.replaceAll("_", " ")}
                  </td>
                  <td className="p-4">{row.name}</td>
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

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Traveler queue
              </p>
              <h2 className="mt-2 text-xl font-bold">Traveler identity + liveness cases</h2>
            </div>
            <span className="rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-[10px] text-zinc-500">
              External approvals cannot be overridden here
            </span>
          </div>

          {travelerCases.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-500">
              No traveler verification cases have been started yet.
            </p>
          ) : (
            travelerCases.map((row) => {
              const evidence = hydrated.ok
                ? hydrated.store.listEvidence(row.id).map(toSafeEvidence)
                : [];
              const events = hydrated.ok ? hydrated.store.listEvents(row.id) : [];
              return (
                <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                        traveler · {row.verification_level}
                      </p>
                      <h3 className="mt-1 font-mono text-sm text-zinc-200">{row.subject_id}</h3>
                    </div>
                    <span className={`font-mono text-xs ${tone(row.status)}`}>
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <CaseMeta label="Provider" value={row.provider} />
                    <CaseMeta
                      label="Evidence"
                      value={
                        evidence.length
                          ? evidence.map((item) => `${item.evidence_type}:${item.status}`).join(", ")
                          : "none"
                      }
                    />
                    <CaseMeta
                      label="Events"
                      value={events.length ? `${events.length} recorded` : "none"}
                    />
                  </div>

                  {row.rejection_reason ? (
                    <p className="mt-4 rounded-xl bg-red-950/20 p-3 text-xs text-red-300">
                      {row.rejection_reason}
                    </p>
                  ) : null}

                  <CaseActions id={row.id} status={row.status} provider={row.provider} />
                </article>
              );
            })
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Other verification cases
            </p>
            <h2 className="mt-2 text-xl font-bold">Drivers, Locals, service specialists and providers</h2>
          </div>

          <CreateCaseForm />

          {cases.filter((row) => row.subject_type !== "traveler").map((row) => {
            const evidence = hydrated.ok
              ? hydrated.store.listEvidence(row.id).map(toSafeEvidence)
              : [];
            return (
              <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                      {row.subject_type} · {row.verification_level}
                    </p>
                    <h3 className="mt-1 font-mono text-sm text-zinc-200">{row.subject_id}</h3>
                  </div>
                  <span className={`font-mono text-xs ${tone(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  Provider {row.provider}
                  {row.reviewed_by ? ` · reviewer ${row.reviewed_by}` : ""}
                  {row.reviewed_at ? ` · ${new Date(row.reviewed_at).toISOString()}` : ""}
                </p>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  Evidence:{" "}
                  {evidence.length
                    ? evidence.map((item) => `${item.evidence_type}:${item.status}`).join(", ")
                    : "none"}
                </p>
                <CaseActions id={row.id} status={row.status} provider={row.provider} />
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
    </div>
  );
}

function CaseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-1 break-words text-xs text-zinc-400">{value}</p>
    </div>
  );
}
