import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { hotelbedsActivitiesConfigured } from "@/lib/integrations/hotelbeds/activities";
import { hotelbedsProductConfig } from "@/lib/integrations/hotelbeds/client";
import ActivitiesProbe from "./ActivitiesProbe";

export const dynamic = "force-dynamic";

export default async function ActivitiesIntegrationPage() {
  await requireAdmin();
  const configured = hotelbedsActivitiesConfigured();
  const config = hotelbedsProductConfig("activities");

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">
          ← Integration Operations
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Hotelbeds Activities
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Activities Booking API</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Governed foundation for Activities search, details/check-rate, confirmation and post-booking operations. Supplier booking remains disabled from verification controls.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard label="Credentials" value={configured ? "Configured" : "Missing"} note="Separate Activities API key and secret" />
          <StatusCard label="Environment" value={config.environment} note={config.baseUrl} />
          <StatusCard label="Booking mode" value="Manual" note="Supplier confirmation stays behind explicit approval/payment workflow" />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Implemented supplier workflow</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FlowStep step="1" title="Search" note="POST /activity-api/3.0/activities" />
            <FlowStep step="2" title="Details / rate check" note="POST /activity-api/3.0/activities/details" />
            <FlowStep step="3" title="Booking" note="PUT /activity-api/3.0/bookings" />
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Two-step preconfirm/reconfirm helpers, booking retrieval and cancellation simulation support already exist in the server integration layer.
          </p>
        </section>

        <ActivitiesProbe />
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
