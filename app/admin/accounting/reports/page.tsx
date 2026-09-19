import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type WindowKey = "30" | "90" | "365";

type PaidVolumeRow = {
  product: string;
  currency: string;
  count: number;
  amount: number;
};

type CurrencyEconomics = {
  currency: string;
  gross: number;
  platformFees: number;
  processorFees: number;
  refunds: number;
  providerNet: number;
  outstandingPayables: number;
  paidPayouts: number;
};

const activeLiability = new Set(["eligible", "approved", "processing", "held"]);
const money = (value: number, currency: string) =>
  `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function addVolume(
  target: Map<string, PaidVolumeRow>,
  product: string,
  currency: string,
  amount: number,
) {
  const code = String(currency || "UNKNOWN").toUpperCase();
  const key = `${product}:${code}`;
  const current = target.get(key) || { product, currency: code, count: 0, amount: 0 };
  current.count += 1;
  current.amount += Number(amount || 0);
  target.set(key, current);
}

function windowStart(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string | string[] }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const requested = Array.isArray(params.window) ? params.window[0] : params.window;
  const windowKey: WindowKey = requested === "90" || requested === "365" ? requested : "30";
  const days = Number(windowKey);
  const since = windowStart(days);

  const [
    hotelResult,
    transferResult,
    activityResult,
    payoutResult,
    foodOrderResult,
    foodRefundResult,
    reviewResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .select("id,customer_currency,currency,customer_retail_amount,retail_amount,payment_status,supplier_settlement_status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("transfer_booking_pricing_ledger")
      .select("id,customer_currency,retail_amount,payment_status,supplier_settlement_status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("activity_booking_pricing_ledger")
      .select("id,customer_currency,retail_amount,payment_status,supplier_settlement_status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("service_provider_payouts")
      .select("id,currency,gross_amount,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("food_orders")
      .select("id,currency,customer_total,payment_status,refunded_amount,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("food_order_refunds")
      .select("id,currency,amount,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("travel_refund_reviews")
      .select("id,product,status,resolution,created_at,resolved_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const paidVolume = new Map<string, PaidVolumeRow>();

  for (const row of hotelResult.data || []) {
    if (row.payment_status !== "paid") continue;
    addVolume(
      paidVolume,
      "Hotels",
      String(row.customer_currency || row.currency || "UNKNOWN"),
      Number(row.customer_retail_amount ?? row.retail_amount ?? 0),
    );
  }

  for (const row of transferResult.data || []) {
    if (row.payment_status !== "paid") continue;
    addVolume(
      paidVolume,
      "Transfers",
      String(row.customer_currency || "UNKNOWN"),
      Number(row.retail_amount || 0),
    );
  }

  for (const row of activityResult.data || []) {
    if (row.payment_status !== "paid") continue;
    addVolume(
      paidVolume,
      "Activities",
      String(row.customer_currency || "UNKNOWN"),
      Number(row.retail_amount || 0),
    );
  }

  for (const row of payoutResult.data || []) {
    addVolume(
      paidVolume,
      "Personal services",
      String(row.currency || "UNKNOWN"),
      Number(row.gross_amount || 0),
    );
  }

  for (const row of foodOrderResult.data || []) {
    if (!["paid", "refunded"].includes(String(row.payment_status))) continue;
    addVolume(
      paidVolume,
      "Food orders",
      String(row.currency || "UNKNOWN"),
      Number(row.customer_total || 0),
    );
  }

  const paidVolumeRows = [...paidVolume.values()].sort((a, b) =>
    a.currency === b.currency
      ? a.product.localeCompare(b.product)
      : a.currency.localeCompare(b.currency),
  );

  const economicsByCurrency = new Map<string, CurrencyEconomics>();
  for (const row of payoutResult.data || []) {
    const currency = String(row.currency || "UNKNOWN").toUpperCase();
    const current = economicsByCurrency.get(currency) || {
      currency,
      gross: 0,
      platformFees: 0,
      processorFees: 0,
      refunds: 0,
      providerNet: 0,
      outstandingPayables: 0,
      paidPayouts: 0,
    };
    current.gross += Number(row.gross_amount || 0);
    current.platformFees += Number(row.platform_fee_amount || 0);
    current.processorFees += Number(row.processor_fee_amount || 0);
    current.refunds += Number(row.refund_amount || 0);
    current.providerNet += Number(row.provider_net_amount || 0);
    if (activeLiability.has(String(row.status))) {
      current.outstandingPayables += Number(row.provider_net_amount || 0);
    }
    if (row.status === "paid") {
      current.paidPayouts += Number(row.provider_net_amount || 0);
    }
    economicsByCurrency.set(currency, current);
  }

  const foodRefundByCurrency = new Map<string, { succeeded: number; pending: number; failed: number }>();
  for (const row of foodRefundResult.data || []) {
    const currency = String(row.currency || "UNKNOWN").toUpperCase();
    const current = foodRefundByCurrency.get(currency) || { succeeded: 0, pending: 0, failed: 0 };
    if (row.status === "succeeded") current.succeeded += Number(row.amount || 0);
    if (row.status === "pending" || row.status === "processing") current.pending += Number(row.amount || 0);
    if (row.status === "failed") current.failed += Number(row.amount || 0);
    foodRefundByCurrency.set(currency, current);
  }

  const supplierRows = [
    ...(hotelResult.data || []).map((row) => ({ product: "Hotels", status: row.supplier_settlement_status })),
    ...(transferResult.data || []).map((row) => ({ product: "Transfers", status: row.supplier_settlement_status })),
    ...(activityResult.data || []).map((row) => ({ product: "Activities", status: row.supplier_settlement_status })),
  ];
  const supplierStatus = new Map<string, number>();
  for (const row of supplierRows) {
    const key = `${row.product}:${row.status}`;
    supplierStatus.set(key, (supplierStatus.get(key) || 0) + 1);
  }

  const reviews = reviewResult.data || [];
  const openReviews = reviews.filter((row) => row.status !== "resolved");
  const resolvedReviews = reviews.filter((row) => row.status === "resolved");

  const queryErrors = [
    hotelResult.error,
    transferResult.error,
    activityResult.error,
    payoutResult.error,
    foodOrderResult.error,
    foodRefundResult.error,
    reviewResult.error,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin/accounting"
          className="font-mono text-xs text-emerald-400 hover:underline"
        >
          ← Accounting & Commission
        </Link>

        <header className="mt-6 border-b border-zinc-800 pb-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400">
            Finance OS / Operational reporting
          </p>
          <h1 className="mt-2 text-4xl font-bold">Finance reports</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Operational reporting from SafariPlug transaction ledgers. Figures remain
            separated by currency and source. This is not a tax return, statutory
            financial statement, or recognized-revenue report.
          </p>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2">
          {(["30", "90", "365"] as WindowKey[]).map((value) => (
            <Link
              key={value}
              href={`/admin/accounting/reports?window=${value}`}
              className={
                value === windowKey
                  ? "rounded-full border border-emerald-500/60 bg-emerald-950/30 px-4 py-2 text-xs font-semibold text-emerald-300"
                  : "rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-400"
              }
            >
              Last {value} days
            </Link>
          ))}
        </nav>

        {queryErrors.length ? (
          <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">
            One or more financial sources could not be loaded. This report may be incomplete.
          </div>
        ) : null}

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Paid-status transaction rows" value={paidVolumeRows.reduce((sum, row) => sum + row.count, 0)} />
          <Metric label="Service payout rows" value={(payoutResult.data || []).length} />
          <Metric label="Open refund reviews" value={openReviews.length} />
          <Metric label="Resolved refund reviews" value={resolvedReviews.length} />
        </section>

        <section className="mt-8">
          <Heading
            title="Paid customer volume"
            text={`Paid-status customer transaction volume from records created in the last ${days} days. Currency totals are never combined.`}
          />
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-4">Product</th>
                  <th>Currency</th>
                  <th>Rows</th>
                  <th>Recorded volume</th>
                </tr>
              </thead>
              <tbody>
                {paidVolumeRows.map((row) => (
                  <tr key={`${row.product}:${row.currency}`} className="border-t border-zinc-900">
                    <td className="p-4 font-medium">{row.product}</td>
                    <td className="font-mono text-xs text-zinc-400">{row.currency}</td>
                    <td>{row.count}</td>
                    <td>{money(row.amount, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!paidVolumeRows.length ? <Empty text="No paid-status transaction rows in this reporting window." /> : null}
          </div>
        </section>

        <section className="mt-8">
          <Heading
            title="Personal-service marketplace economics"
            text="Payout-backed service economics only. Platform fee figures here do not include travel or food products."
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[...economicsByCurrency.values()].map((row) => (
              <div key={row.currency} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{row.currency}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    Service ledger
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-3">
                  <Money label="Gross" value={money(row.gross, row.currency)} />
                  <Money label="Platform fees" value={money(row.platformFees, row.currency)} />
                  <Money label="Processor fees" value={money(row.processorFees, row.currency)} />
                  <Money label="Recorded refunds" value={money(row.refunds, row.currency)} />
                  <Money label="Provider net" value={money(row.providerNet, row.currency)} />
                  <Money label="Outstanding payables" value={money(row.outstandingPayables, row.currency)} />
                  <Money label="Paid payouts" value={money(row.paidPayouts, row.currency)} />
                </dl>
              </div>
            ))}
            {!economicsByCurrency.size ? <Empty text="No personal-service payout economics in this reporting window." /> : null}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <Panel title="Food-order refunds">
            {[...foodRefundByCurrency.entries()].map(([currency, values]) => (
              <div key={currency} className="border-t border-zinc-900 py-4 first:border-t-0">
                <p className="font-semibold">{currency}</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Line label="Succeeded" value={money(values.succeeded, currency)} />
                  <Line label="Pending / processing" value={money(values.pending, currency)} />
                  <Line label="Failed" value={money(values.failed, currency)} />
                </div>
              </div>
            ))}
            {!foodRefundByCurrency.size ? <Empty text="No food-order refund records in this window." /> : null}
          </Panel>

          <Panel title="Refund-review workload">
            <Line label="Open" value={String(openReviews.length)} />
            <Line label="Resolved" value={String(resolvedReviews.length)} />
            {["hotel", "transfer", "activity", "service", "food"].map((product) => (
              <Line
                key={product}
                label={product}
                value={String(reviews.filter((row) => row.product === product).length)}
              />
            ))}
            <Link
              href="/admin/accounting/refunds"
              className="mt-4 inline-flex text-sm font-semibold text-emerald-400"
            >
              Open refund review →
            </Link>
          </Panel>
        </section>

        <section className="mt-8">
          <Heading
            title="Travel supplier settlement states"
            text="Operational booking-ledger settlement states for hotel, transfer and activity sources."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {["Hotels", "Transfers", "Activities"].map((product) => {
              const statuses = [...supplierStatus.entries()]
                .filter(([key]) => key.startsWith(`${product}:`))
                .map(([key, count]) => ({ status: key.split(":").slice(1).join(":"), count }));
              return (
                <div key={product} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="font-semibold">{product}</h3>
                  <div className="mt-4">
                    {statuses.map((row) => (
                      <Line key={row.status} label={row.status.replaceAll("_", " ")} value={String(row.count)} />
                    ))}
                    {!statuses.length ? <p className="text-sm text-zinc-500">No records in this window.</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-amber-900/30 bg-amber-950/10 p-6">
          <p className="font-semibold text-amber-200">Accounting-policy boundary</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            These reports summarize operational records only. SafariPlug should not present
            them as recognized revenue, profit, tax liability, or audited statements until
            formal accounting policies define recognition timing, FX treatment, taxes,
            supplier liabilities, chargebacks, and period close controls.
          </p>
        </section>
      </div>
    </main>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{text}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-zinc-900 py-3 text-sm first:border-t-0">
      <span className="capitalize text-zinc-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-5 text-sm text-zinc-500">{text}</p>;
}
