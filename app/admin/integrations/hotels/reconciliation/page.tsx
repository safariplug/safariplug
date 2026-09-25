import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import ReconciliationActions from "./ReconciliationActions";
import LockTripReconciliationActions from "./LockTripReconciliationActions";

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  provider: string;
  prepared_booking_id: string;
  provider_booking_reference: string | null;
  customer_currency: string | null;
  customer_retail_amount: number | null;
  retail_amount: number | null;
  payment_status: string;
  booking_status: string;
  supplier_settlement_status: string;
  paid_at: string | null;
  created_at: string;
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

export default async function HotelReconciliationPage() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("hotel_booking_pricing_ledger")
    .select("id,provider,prepared_booking_id,provider_booking_reference,customer_currency,customer_retail_amount,retail_amount,payment_status,booking_status,supplier_settlement_status,paid_at,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  const rows = ((data || []) as LedgerRow[]).filter(needsReconciliation);

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin/integrations/hotels" className="font-mono text-xs text-amber-400 hover:underline">
          ← Hotel connectivity
        </Link>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            Manual reconciliation
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Hotel confirmation reconciliation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Paid hotel bookings appear here only when SafariPlug could not prove the supplier confirmation result.
            This workspace never re-submits a supplier confirmation. Hotelbeds cases may verify one known supplier reference;
            LockTrip cases may perform one read-only lookup of the existing prepared booking.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card label="Needs review" value={String(rows.length)} note="Paid + supplier confirmation indeterminate" />
          <Card label="Automatic booking retry" value="Disabled" note="Prevents duplicate hotel reservations" />
          <Card label="Refund handling" value="Manual" note="No automatic M-Pesa refund" />
        </section>

        {!rows.length ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
            No paid hotel confirmations currently require reconciliation.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const metadata = row.metadata || {};
              const hotelName =
                typeof metadata.hotelName === "string" && metadata.hotelName.trim()
                  ? metadata.hotelName
                  : "Hotelbeds hotel";
              const attemptedAt =
                typeof metadata.confirmAttemptIndeterminateAt === "string"
                  ? metadata.confirmAttemptIndeterminateAt
                  : null;
              const errorMessage =
                typeof metadata.confirmAttemptError === "string"
                  ? metadata.confirmAttemptError
                  : "Hotelbeds confirmation result was indeterminate.";
              const amount = Number(row.customer_retail_amount ?? row.retail_amount ?? 0);
              const currency = row.customer_currency || "KES";

              return (
                <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">{row.provider}</p>
                      <p className="mt-1 text-lg font-bold">{hotelName}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-500">{row.prepared_booking_id}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-400">
                        Supplier ref: {row.provider_booking_reference || "unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">
                        {currency} {amount.toLocaleString()}
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

                  {row.provider === "hotelbeds" ? (
                    <ReconciliationActions
                      ledgerId={row.id}
                      preparedBookingId={row.prepared_booking_id}
                      storedReference={row.provider_booking_reference || ""}
                    />
                  ) : (
                    <LockTripReconciliationActions
                      ledgerId={row.id}
                      preparedBookingId={row.prepared_booking_id}
                    />
                  )}
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
  return (
    <div className="rounded-xl bg-black p-3">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{value}</p>
    </div>
  );
}
