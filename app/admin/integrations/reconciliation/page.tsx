import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export default async function ReconciliationCommandCenter() {
  await requireAdmin();

  const [transfers, activities, hotels, hotelIntents] = await Promise.all([
    supabaseAdmin
      .from("transfer_booking_pricing_ledger")
      .select("id,payment_status,booking_status,metadata")
      .eq("provider","hotelbeds")
      .order("created_at",{ascending:false})
      .limit(250),
    supabaseAdmin
      .from("activity_booking_pricing_ledger")
      .select("id,payment_status,booking_status,metadata")
      .eq("provider","hotelbeds")
      .order("created_at",{ascending:false})
      .limit(250),
    supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .select("id,provider,payment_status,booking_status,metadata")
      .order("created_at",{ascending:false})
      .limit(250),
    supabaseAdmin
      .from("hotel_checkout_intents")
      .select("id,provider,state,prepared_booking_id,last_error,created_at")
      .in("state",["payment_indeterminate","supplier_prepare_indeterminate"])
      .order("created_at",{ascending:false})
      .limit(250),
  ]);

  const transferRows=(transfers.data||[]).filter(row=>{
    const m=metadataRecord(row.metadata);
    return row.payment_status==="paid"&&row.booking_status==="payment_pending"&&Boolean(m.confirmAttemptIndeterminateAt);
  });

  const activityRows=(activities.data||[]).filter(row=>{
    const m=metadataRecord(row.metadata);
    return row.payment_status==="paid"&&row.booking_status==="payment_pending"&&Boolean(m.reconfirmAttemptIndeterminateAt);
  });

  const hotelConfirmRows=(hotels.data||[]).filter(row=>{
    const m=metadataRecord(row.metadata);
    return row.payment_status==="paid"&&row.booking_status==="payment_pending"&&Boolean(m.confirmAttemptIndeterminateAt);
  });
  const hotelbedsConfirmRows=hotelConfirmRows.filter(row=>row.provider==="hotelbeds");
  const locktripConfirmRows=hotelConfirmRows.filter(row=>row.provider==="locktrip");

  const hotelIntentRows=hotelIntents.data||[];
  const paymentIndeterminate=hotelIntentRows.filter(row=>row.state==="payment_indeterminate");
  const supplierPrepareIndeterminate=hotelIntentRows.filter(row=>row.state==="supplier_prepare_indeterminate");
  const total=transferRows.length+activityRows.length+hotelConfirmRows.length+hotelIntentRows.length;

  const queryErrors=[
    transfers.error,
    activities.error,
    hotels.error,
    hotelIntents.error,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin/integrations" className="font-mono text-xs text-amber-400 hover:underline">
          ← Integration Operations
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Reconciliation command center
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Bookings that need human attention</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            SafariPlug stops automatic retries when supplier or payment outcomes are uncertain.
            This screen summarizes those cases without making supplier or payment calls.
          </p>
        </header>

        {queryErrors.length ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">
            One or more reconciliation sources could not be loaded. The counts below may be incomplete.
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Needs attention" value={String(total)} note="Across governed supplier/payment flows" />
          <Metric label="Transfers" value={String(transferRows.length)} note="Paid + confirmation indeterminate" />
          <Metric label="Activities" value={String(activityRows.length)} note="Paid + RECONFIRM indeterminate" />
          <Metric label="Hotel confirmations" value={String(hotelConfirmRows.length)} note="Paid + confirmation indeterminate" />
          <Metric label="Hotel checkout intents" value={String(hotelIntentRows.length)} note="Supplier/payment submission uncertain" />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <QueueCard
            title="Hotelbeds Transfers"
            count={transferRows.length}
            href="/admin/integrations/transfers/reconciliation"
            body="Verify an existing supplier reference or record that no supplier booking exists. Never creates another transfer booking."
          />
          <QueueCard
            title="Hotelbeds Activities"
            count={activityRows.length}
            href="/admin/integrations/activities/reconciliation"
            body="Resolve paid PRECONFIRMED activities whose RECONFIRM result is uncertain without replaying RECONFIRM."
          />
          <QueueCard
            title="Hotel confirmations"
            count={hotelConfirmRows.length}
            href="/admin/integrations/hotels/reconciliation"
            body={`Hotelbeds ${hotelbedsConfirmRows.length} · LockTrip ${locktripConfirmRows.length}. Verify existing supplier state without replaying confirmation.`}
          />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Hotel checkout safety</p>
              <h2 className="mt-2 text-xl font-bold">Indeterminate supplier/payment initiation</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                These are earlier-stage checkout attempts where SafariPlug could not prove whether LockTrip supplier preparation
                or M-Pesa initiation succeeded. Automatic resubmission stays disabled.
              </p>
            </div>
            <span className="rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-[10px] text-amber-300">
              {hotelIntentRows.length} open
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <IntentGroup title="Payment initiation uncertain" rows={paymentIndeterminate} />
            <IntentGroup title="Supplier preparation uncertain" rows={supplierPrepareIndeterminate} />
          </div>
        </section>

        <section className="rounded-2xl border border-amber-900/30 bg-amber-950/10 p-6">
          <p className="font-semibold text-amber-200">Operational rule</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Reconciliation may verify an existing supplier state or record a human-reviewed resolution.
            It must not silently retry a booking, PRECONFIRM/RECONFIRM, supplier preparation, or uncertain M-Pesa submission.
            Customer refunds remain a separate governed action.
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({label,value,note}:{label:string;value:string;note:string}) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    <p className="mt-2 font-mono text-2xl font-bold text-amber-400">{value}</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>
  </div>;
}

function QueueCard({title,count,href,body}:{title:string;count:number;href:string;body:string}) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <span className="rounded-full bg-amber-400/10 px-3 py-1 font-mono text-xs text-amber-300">{count}</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-zinc-500">{body}</p>
    <Link href={href} className="mt-5 inline-block text-sm font-bold text-amber-400">Open queue →</Link>
  </article>;
}

function IntentGroup({
  title,
  rows,
}:{
  title:string;
  rows:Array<{id:string;provider:string;state:string;prepared_booking_id:string|null;last_error:string|null;created_at:string}>;
}) {
  return <div className="rounded-2xl bg-black p-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">{title}</h3>
      <span className="font-mono text-xs text-amber-300">{rows.length}</span>
    </div>
    {!rows.length ? <p className="mt-4 text-xs text-zinc-600">No open cases.</p> :
      <div className="mt-4 space-y-3">
        {rows.slice(0,10).map(row=><div key={row.id} className="rounded-xl border border-zinc-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{row.provider}</p>
            <p className="text-[10px] text-zinc-600">{new Date(row.created_at).toLocaleString()}</p>
          </div>
          <p className="mt-1 font-mono text-xs text-zinc-300">{row.prepared_booking_id||row.id}</p>
          {row.last_error?<p className="mt-2 line-clamp-2 text-xs leading-5 text-red-300/80">{row.last_error}</p>:null}
        </div>)}
      </div>
    }
  </div>;
}
