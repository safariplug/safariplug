import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hotelbedsContentEnvironment } from "@/lib/integrations/hotels/hotelbeds-content";
import HotelbedsActions from "./HotelbedsActions";

export const dynamic = "force-dynamic";

type ReadinessState = "ready" | "blocked" | "manual" | "implemented";

type ChecklistItem = {
  label: string;
  detail: string;
  state: ReadinessState;
};

export default async function HotelbedsIntegrationPage() {
  await requireAdmin();

  const [{ count }, stateResult] = await Promise.all([
    supabaseAdmin.from("hotelbeds_hotel_content").select("hotel_code", { count: "exact", head: true }),
    supabaseAdmin
      .from("hotelbeds_content_sync_state")
      .select("next_from,page_size,language,supplier_total,last_page_count,status,last_error,last_started_at,last_completed_at,updated_at")
      .eq("sync_key", "hotel-content")
      .maybeSingle(),
  ]);

  const state = stateResult.data;
  const readiness = {
    apiKey: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY?.trim()),
    secret: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET?.trim()),
    certificate: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM?.trim() || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT?.trim()),
    privateKey: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM?.trim() || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY?.trim()),
  };

  const credentialReady = readiness.apiKey && readiness.secret;
  const mtlsReady = readiness.certificate && readiness.privateKey;
  const cachedHotels = count ?? 0;
  const contentReady = cachedHotels > 0;
  const syncHealthy = state?.status !== "error" && !state?.last_error;

  const checklist: ChecklistItem[] = [
    {
      label: "Hotel API credentials",
      detail: "API key and secret are present server-side without exposing their values.",
      state: credentialReady ? "ready" : "blocked",
    },
    {
      label: "Hotel API mTLS",
      detail: "Client certificate and private key are required for availability, CheckRate and booking operations.",
      state: mtlsReady ? "ready" : "blocked",
    },
    {
      label: "Static content cache",
      detail: contentReady ? `${cachedHotels.toLocaleString()} Hotelbeds hotel records are cached locally.` : "No Hotelbeds hotel content has been cached yet.",
      state: contentReady ? "ready" : "blocked",
    },
    {
      label: "Content synchronization",
      detail: syncHealthy ? "No current Content API sync error is recorded." : state?.last_error || "Content synchronization needs attention.",
      state: syncHealthy ? "ready" : "blocked",
    },
    {
      label: "Availability → CheckRate governance",
      detail: "RECHECK rates use CheckRate; BOOKABLE rates do not trigger an unnecessary CheckRate call.",
      state: "implemented",
    },
    {
      label: "Traveler preflight & notices",
      detail: "Room, board, cancellation terms, supplier notices and verified SafariPlug total are presented before payment acceptance.",
      state: "implemented",
    },
    {
      label: "Payment-first booking",
      detail: "Hotelbeds confirmation is gated behind successful customer payment and ambiguous confirmations are not blindly retried.",
      state: "implemented",
    },
    {
      label: "Voucher generation",
      detail: "Confirmed Hotelbeds stays produce governed voucher data with booking, hotel, room, board and passenger context.",
      state: "implemented",
    },
    {
      label: "Cancellation simulation",
      detail: "Cancellation is simulated before an explicit supplier cancellation is executed.",
      state: "implemented",
    },
    {
      label: "Live end-to-end certification run",
      detail: "Run the controlled Hotelbeds test scenario and retain the supplier references/results for certification evidence.",
      state: credentialReady && mtlsReady ? "manual" : "blocked",
    },
  ];

  const blockedCount = checklist.filter((item) => item.state === "blocked").length;
  const nextAction = !credentialReady
    ? "Add the Hotelbeds Hotel API key and secret in the production environment."
    : !mtlsReady
      ? "Install the Hotelbeds mTLS client certificate and private key, then run API health verification."
      : !contentReady
        ? "Run one controlled Content API sample, then sync one page into the local cache."
        : !syncHealthy
          ? "Resolve the recorded Content API sync error before certification testing."
          : "Run API health verification, then execute the end-to-end Hotelbeds certification scenario.";

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">← Integrations</Link>

        <header className="border-b border-zinc-800 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">Hotel supplier / certification</p>
              <h1 className="mt-2 text-3xl font-extrabold">Hotelbeds Certification Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">One governed workspace for configuration, content readiness, checkout controls and the remaining live certification steps. Secret values are never displayed.</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Current state</p>
              <p className={blockedCount === 0 ? "mt-2 font-mono text-lg font-bold text-emerald-400" : "mt-2 font-mono text-lg font-bold text-amber-400"}>
                {blockedCount === 0 ? "Ready for live verification" : `${blockedCount} blocker${blockedCount === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Status label="Environment" value={hotelbedsContentEnvironment()} tone="neutral" />
          <Status label="Hotel API auth" value={credentialReady ? "Configured" : "Missing"} tone={credentialReady ? "good" : "warning"} />
          <Status label="Hotel mTLS" value={mtlsReady ? "Configured" : "Missing"} tone={mtlsReady ? "good" : "warning"} />
          <Status label="Cached hotels" value={cachedHotels.toLocaleString()} tone={contentReady ? "good" : "warning"} />
        </section>

        <section className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">Next action</p>
          <p className="mt-2 text-base font-semibold text-zinc-100">{nextAction}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">SafariPlug keeps Hotelbeds supplier calls explicit on this screen to protect evaluation quota and prevent accidental booking or cancellation activity.</p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Certification readiness checklist</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Implemented means the SafariPlug control exists in code. Ready means the required runtime dependency is present. Manual means a controlled live verification still has to be performed.</p>
            </div>
            <p className="font-mono text-xs text-zinc-500">{checklist.filter((item) => item.state !== "blocked").length}/{checklist.length} not blocked</p>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {checklist.map((item) => <ChecklistCard key={item.label} item={item} />)}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Controlled verification</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Health checks are safe status requests. Content sample and sync actions consume Hotelbeds evaluation requests, so they only run when you click them.</p>
          <div className="mt-5"><HotelbedsActions /></div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Content sync state</h2>
            <StateBadge state={syncHealthy ? "ready" : "blocked"} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Status" value={state?.status || "Not initialized"} />
            <Metric label="Next record" value={String(state?.next_from ?? 1)} />
            <Metric label="Last page" value={String(state?.last_page_count ?? 0)} />
            <Metric label="Supplier total" value={state?.supplier_total == null ? "—" : String(state.supplier_total)} />
          </dl>
          <dl className="mt-5 grid gap-4 border-t border-zinc-900 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Page size" value={String(state?.page_size ?? "—")} />
            <Metric label="Language" value={state?.language || "—"} />
            <Metric label="Last completed" value={formatDate(state?.last_completed_at)} />
          </dl>
          {state?.last_error ? <p className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{state.last_error}</p> : null}
          <p className="mt-5 text-xs leading-5 text-zinc-500">Cron endpoint: <code>/api/cron/hotelbeds-content</code>. It requires the existing CRON_SECRET bearer token and processes at most one Content API page per invocation.</p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Certification evidence path</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <EvidenceStep number="01" title="Verify" detail="Confirm credentials, mTLS, API health and local Content API cache." />
            <EvidenceStep number="02" title="Exercise" detail="Run Availability → CheckRate when required → preflight → payment → booking → voucher → cancellation simulation." />
            <EvidenceStep number="03" title="Retain" detail="Keep test references and outcomes for the Hotelbeds certification submission. Do not expose supplier secrets or customer payment data." />
          </div>
        </section>
      </div>
    </main>
  );
}

function Status({ label, value, tone }: { label: string; value: string; tone: "good" | "warning" | "neutral" }) {
  const valueClass = tone === "good" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : "text-zinc-200";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-2 font-mono text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ChecklistCard({ item }: { item: ChecklistItem }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-zinc-100">{item.label}</h3>
        <StateBadge state={item.state} />
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{item.detail}</p>
    </div>
  );
}

function StateBadge({ state }: { state: ReadinessState }) {
  if (state === "ready") return <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">Ready</span>;
  if (state === "implemented") return <span className="rounded-full border border-sky-800 bg-sky-950/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">Implemented</span>;
  if (state === "manual") return <span className="rounded-full border border-violet-800 bg-violet-950/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-violet-300">Manual test</span>;
  return <span className="rounded-full border border-amber-800 bg-amber-950/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">Blocked</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</dt><dd className="mt-1 font-semibold text-zinc-200">{value}</dd></div>;
}

function EvidenceStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
      <p className="font-mono text-xs font-bold text-amber-400">{number}</p>
      <p className="mt-2 text-sm font-bold text-zinc-100">{title}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" });
}
