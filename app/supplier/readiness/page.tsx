"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Account = {
  onboarding_status?: string | null;
  completion_percent?: number | null;
  review_items?: string[] | null;
};

type ReadinessIssue = {
  key: string;
  label: string;
  href: string;
  owner?: "supplier" | "platform";
};

type ActivationReadiness = {
  ready: boolean;
  appointmentProvider: boolean;
  completionPercent: number;
  issues: ReadinessIssue[];
  checks?: Record<string, boolean>;
};

type SupplierData = {
  account?: Account | null;
  activationReadiness?: ActivationReadiness | null;
};

export default function SupplierReadinessPage() {
  const [data, setData] = useState<SupplierData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
      const body = await response.json().catch(() => null) as (SupplierData & { error?: string }) | null;
      if (!response.ok) {
        setError(body?.error || "Unable to load readiness.");
        return;
      }
      setData(body || {});
    })();
  }, []);

  if (error) {
    return <main className="mx-auto max-w-4xl px-6 py-10"><p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p></main>;
  }

  if (!data) {
    return <main className="mx-auto max-w-4xl px-6 py-10"><p className="text-sm text-black/50">Loading readiness…</p></main>;
  }

  const readiness = data.activationReadiness;
  const blockers = readiness?.issues ?? [];
  const score = Number(readiness?.completionPercent ?? data.account?.completion_percent ?? 0);
  const status = String(data.account?.onboarding_status || "draft");
  const requested = Array.isArray(data.account?.review_items) ? data.account.review_items : [];

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Supplier</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Readiness center</h1>
      </div>
      <Link href="/supplier" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to onboarding</Link>
    </div>

    <p className="mt-3 max-w-2xl text-black/55">
      This is the same activation-readiness check SafariPlug staff use for review and approval. It uses your existing SafariPlug data and costs no AI credits.
    </p>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <Metric label="Profile score" value={`${score}%`} />
      <Metric label="Open blockers" value={String(blockers.length)} />
      <Metric label="Status" value={status.replaceAll("_", " ")} />
    </section>

    {requested.length > 0 && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-900/60">Staff-requested changes</p>
      <p className="mt-2 text-sm text-black/60">SafariPlug requested {requested.length} fix{requested.length === 1 ? "" : "es"}. These take priority over the general checklist.</p>
      <Link href="/supplier/ai-help" className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Get help fixing them →</Link>
    </section>}

    <section className="mt-6 rounded-3xl border border-black/10 p-5 md:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-black/40">Activation blockers</p>
          <h2 className="mt-1 text-2xl font-semibold">
            {blockers.length ? `${blockers.length} item${blockers.length === 1 ? "" : "s"} to finish` : "Ready for staff review"}
          </h2>
        </div>
      </div>

      {blockers.length ? <div className="mt-4 divide-y divide-black/10">
        {blockers.map((item) => <div key={item.key} className="flex items-start gap-3 py-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-xs font-bold text-black/50">!</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{item.label}</h3>
              {item.owner === "platform" && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">SafariPlug action</span>}
            </div>
            <p className="mt-1 text-sm text-black/50">{item.owner === "platform" ? "SafariPlug staff must complete this step." : "Complete this step before activation."}</p>
          </div>
          <Link href={item.href} className="shrink-0 text-sm font-semibold">{item.owner === "platform" ? "View →" : "Fix →"}</Link>
        </div>)}
      </div> : <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        All canonical activation requirements are satisfied. Staff review and approval are still required before the listing becomes active.
      </p>}
    </section>

    <section className="mt-6 rounded-2xl bg-black/[.03] p-5">
      <h2 className="font-semibold">What happens next</h2>
      <p className="mt-1 text-sm leading-6 text-black/55">
        Complete every supplier-owned blocker, then submit your onboarding for human review. Verification, approval and publishing remain staff-controlled.
      </p>
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-1 text-xl font-semibold capitalize">{value}</p></div>;
}
