import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ReconciliationActions from "./ReconciliationActions";

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  prepared_booking_id: string;
  provider_booking_reference: string | null;
  customer_currency: string;
  retail_amount: number;
  payment_status: string;
  booking_status: string;
  supplier_settlement_status: string;
  created_at: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
};

function needsReconciliation(row: LedgerRow) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return (
    row.payment_status === "paid" &&
    row.booking_status === "payment_pending" &&
    Boolean(metadata.confirmAttemptIndeterminateAt)
  );
}

export default async function TransferReconciliationPage() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("transfer_booking_pricing_ledger")
    .select("id,prepared_booking_id,provider_booking_reference,customer_currency,retail_amount,payment_status,booking_status,supplier_settlement_status,created_at,paid_at,metadata")
    .eq("provider", "hotelbeds")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows = ((data || []) as LedgerRow[]).filter(needsReconciliation);

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin/integrations/transfers" className="font-mono text-xs text-amber-400 hover:underline">
          ← Transfer connectivity
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Manual reconciliation
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Hotelbeds transfer confirmations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Paid transfers appear here only when SafariPlug could not prove supplier confirmation.
            SafariPlug never retries booking creation from this workspace. Staff must verify an existing
            supplier reference or explicitly record that no supplier booking exists.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card label="Needs review" value={String(rows.length)} note="Paid + confirmation indeterminate" />
          <Card label="Automatic retries" value="Disabled" note="Prevents duplicate transfer bookings" />
          <Card label="Refund handling" value="Manual" note="Supplier resolution does not auto-refund M-Pesa" />
        </section>

        {!rows.length ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
            No paid Hotelbeds transfer confirmations currently require reconciliation.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const metadata = row.metadata || {};
              const errorMessage =
                typeof metadata.confirmAttemptError === "string"
                  ? metadata.confirmAttemptError
                  : "Supplier confirmation result was indeterminate.";
              const attemptedAt =
                typeof metadata.confirmAttemptIndeterminateAt === "string"
                  ? metadata.confirmAttemptIndeterminateAt
                  : null;
              return (
                <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">SafariPlug booking</p>
                      <p className="mt-1 font-mono text-sm text-zinc-200">{row.prepared_booking_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">
                        {row.customer_currency} {Number(row.retail_amount).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">Payment: {row.payment_status}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <Meta label="Booking status" value={row.booking_status} />
                    <Meta label="Supplier settlement" value={row.supplier_settlement_status} />
                    <Meta label="Attempted" value={attemptedAt ? new Date(attemptedAt).toLocaleString() : "Unknown"} />
                  </div>

                  <div className="mt-4 rounded-xl border border-red-900/30 bg-red-950/20 p-4 text-sm leading-6 text-red-200">
                    {errorMessage}
                  </div>

                  <ReconciliationActions ledgerId={row.id} preparedBookingId={row.prepared_booking_id} />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black p-3"><p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-300">{value}</p></div>;
}
