import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hotelbedsContentEnvironment } from "@/lib/integrations/hotels/hotelbeds-content";
import HotelbedsActions from "./HotelbedsActions";

export const dynamic = "force-dynamic";

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

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">← Integrations</Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">Hotel supplier / certification</p>
          <h1 className="mt-2 text-3xl font-extrabold">Hotelbeds readiness</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Verify the test environment, inspect credential presence without revealing secrets, and ingest static Content API records into SafariPlug storage one controlled page at a time.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Status label="Environment" value={hotelbedsContentEnvironment()} />
          <Status label="Hotel API auth" value={readiness.apiKey && readiness.secret ? "Configured" : "Missing"} />
          <Status label="Hotel mTLS" value={readiness.certificate && readiness.privateKey ? "Configured" : "Missing"} />
          <Status label="Cached hotels" value={String(count ?? 0)} />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Controlled verification</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Health checks are safe status requests. Content sample and sync actions consume Hotelbeds evaluation requests, so they only run when you click them.</p>
          <div className="mt-5"><HotelbedsActions /></div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Content sync state</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Status" value={state?.status || "Not initialized"} />
            <Metric label="Next record" value={String(state?.next_from ?? 1)} />
            <Metric label="Last page" value={String(state?.last_page_count ?? 0)} />
            <Metric label="Supplier total" value={state?.supplier_total == null ? "—" : String(state.supplier_total)} />
          </dl>
          {state?.last_error ? <p className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{state.last_error}</p> : null}
          <p className="mt-5 text-xs leading-5 text-zinc-500">Cron endpoint: <code>/api/cron/hotelbeds-content</code>. It requires the existing CRON_SECRET bearer token and processes at most one Content API page per invocation.</p>
        </section>
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</dt><dd className="mt-1 font-semibold text-zinc-200">{value}</dd></div>;
}
