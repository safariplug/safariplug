import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import RefundReviewActions from "./RefundReviewActions";

export const dynamic = "force-dynamic";

type Candidate = {
  product: "hotel" | "transfer" | "activity" | "service";
  ledgerId: string;
  provider: string;
  customerUserId: string;
  amount: number;
  currency: string;
  bookingStatus: string;
  paymentStatus: string;
  reason: string;
  createdAt: string;
  refundStatus: string;
};

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function reasonFromMetadata(metadata: Record<string, unknown>, fallback: string) {
  const reconciliation =
    metadata.reconciliation &&
    typeof metadata.reconciliation === "object" &&
    !Array.isArray(metadata.reconciliation)
      ? metadata.reconciliation as Record<string, unknown>
      : {};
  if (typeof reconciliation.status === "string" && reconciliation.status) {
    return `${fallback}: ${reconciliation.status}`;
  }
  return fallback;
}

export default async function TravelRefundReviewPage() {
  await requireAdmin();

  const [hotelResult, transferResult, activityResult, serviceLedgerResult, serviceAppointmentResult, serviceAttemptResult, serviceEventResult, reviewResult] = await Promise.all([
    supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .select("id,customer_user_id,provider,customer_currency,currency,customer_retail_amount,retail_amount,payment_status,booking_status,created_at,metadata")
      .order("created_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("transfer_booking_pricing_ledger")
      .select("id,customer_user_id,provider,customer_currency,retail_amount,payment_status,booking_status,created_at,metadata")
      .order("created_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("activity_booking_pricing_ledger")
      .select("id,customer_user_id,provider,customer_currency,retail_amount,payment_status,booking_status,created_at,metadata")
      .order("created_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("service_payment_ledger")
      .select("id,appointment_id,payment_reference,provider_reference,currency,gross_amount,customer_total_amount,status,refunded_amount,created_at")
      .order("created_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("service_appointments")
      .select("id,customer_user_id,status,payment_status,created_at")
      .order("created_at",{ascending:false})
      .limit(1000),
    supabaseAdmin
      .from("service_payment_idempotency")
      .select("appointment_id,provider,provider_reference,attempt_active,created_at")
      .order("created_at",{ascending:false})
      .limit(1000),
    supabaseAdmin
      .from("service_payment_events")
      .select("appointment_id,provider,provider_reference,created_at")
      .order("created_at",{ascending:false})
      .limit(1000),
    supabaseAdmin
      .from("travel_refund_reviews")
      .select("id,product,ledger_id,provider,reason,status,resolution,notes,assigned_to,resolved_by,resolved_at,created_at,updated_at")
      .order("created_at",{ascending:false})
      .limit(1000),
  ]);

  const candidates: Candidate[] = [];

  for (const row of hotelResult.data || []) {
    const metadata = metadataRecord(row.metadata);
    const refundStatus = String(metadata.refundStatus || "");
    if (!["manual_required","not_automated"].includes(refundStatus)) continue;
    if (row.payment_status !== "paid") continue;
    candidates.push({
      product:"hotel",
      ledgerId:row.id,
      provider:row.provider,
      customerUserId:row.customer_user_id,
      amount:Number(row.customer_retail_amount ?? row.retail_amount ?? 0),
      currency:String(row.customer_currency || row.currency || "KES"),
      bookingStatus:row.booking_status,
      paymentStatus:row.payment_status,
      reason:reasonFromMetadata(metadata,"Hotel booking may require customer refund review"),
      createdAt:row.created_at,
      refundStatus,
    });
  }

  for (const row of transferResult.data || []) {
    const metadata = metadataRecord(row.metadata);
    const refundStatus = String(metadata.refundStatus || "");
    if (!["manual_required","not_automated"].includes(refundStatus)) continue;
    if (row.payment_status !== "paid") continue;
    candidates.push({
      product:"transfer",
      ledgerId:row.id,
      provider:row.provider,
      customerUserId:row.customer_user_id,
      amount:Number(row.retail_amount ?? 0),
      currency:String(row.customer_currency || "KES"),
      bookingStatus:row.booking_status,
      paymentStatus:row.payment_status,
      reason:reasonFromMetadata(metadata,"Transfer booking may require customer refund review"),
      createdAt:row.created_at,
      refundStatus,
    });
  }

  for (const row of activityResult.data || []) {
    const metadata = metadataRecord(row.metadata);
    const refundStatus = String(metadata.refundStatus || "");
    if (!["manual_required","not_automated"].includes(refundStatus)) continue;
    if (row.payment_status !== "paid") continue;
    candidates.push({
      product:"activity",
      ledgerId:row.id,
      provider:row.provider,
      customerUserId:row.customer_user_id,
      amount:Number(row.retail_amount ?? 0),
      currency:String(row.customer_currency || "KES"),
      bookingStatus:row.booking_status,
      paymentStatus:row.payment_status,
      reason:reasonFromMetadata(metadata,"Activity booking may require customer refund review"),
      createdAt:row.created_at,
      refundStatus,
    });
  }

  const appointmentById=new Map((serviceAppointmentResult.data||[]).map(row=>[row.id,row]));
  const providerByAppointment=new Map<string,string>();
  for(const attempt of serviceAttemptResult.data||[]) {
    if(!providerByAppointment.has(attempt.appointment_id)) {
      providerByAppointment.set(attempt.appointment_id,String(attempt.provider||"service-payment"));
    }
  }
  const providerByPaymentReference=new Map<string,string>();
  for(const event of serviceEventResult.data||[]) {
    if(!event.provider_reference) continue;
    const key=`${event.appointment_id}:${event.provider_reference}`;
    if(!providerByPaymentReference.has(key)) {
      providerByPaymentReference.set(key,String(event.provider||"service-payment"));
    }
  }

  for (const row of serviceLedgerResult.data || []) {
    const appointment=appointmentById.get(row.appointment_id);
    if(!appointment) continue;
    const disputed=row.status==="disputed";
    const paidCancelled=appointment.status==="cancelled" && ["paid","partially_refunded"].includes(row.status);
    if(!disputed && !paidCancelled) continue;

    candidates.push({
      product:"service",
      ledgerId:row.id,
      provider:(row.payment_reference
        ? providerByPaymentReference.get(`${row.appointment_id}:${row.payment_reference}`)
        : null) || providerByAppointment.get(row.appointment_id) || "service-payment",
      customerUserId:String(appointment.customer_user_id||"unknown"),
      amount:Number(row.customer_total_amount ?? row.gross_amount ?? 0),
      currency:String(row.currency||"KES"),
      bookingStatus:String(appointment.status||"unknown"),
      paymentStatus:String(row.status||appointment.payment_status||"unknown"),
      reason:disputed
        ?"Service payment dispute requires finance reconciliation"
        :"Paid service appointment was cancelled and may require customer refund review",
      createdAt:row.created_at,
      refundStatus:disputed?"disputed_payment":"paid_cancelled_appointment",
    });
  }

  const reviews=reviewResult.data||[];
  const reviewByKey=new Map(reviews.map(row=>[`${row.product}:${row.ledger_id}`,row]));
  candidates.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const pending=candidates.filter(item=>{
    const review=reviewByKey.get(`${item.product}:${item.ledgerId}`);
    return !review || review.status!=="resolved";
  });
  const resolved=candidates.filter(item=>reviewByKey.get(`${item.product}:${item.ledgerId}`)?.status==="resolved");

  const queryErrors=[
    hotelResult.error,
    transferResult.error,
    activityResult.error,
    serviceLedgerResult.error,
    serviceAppointmentResult.error,
    serviceAttemptResult.error,
    serviceEventResult.error,
    reviewResult.error,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/accounting" className="font-mono text-xs text-emerald-400 hover:underline">
          ← Accounting & Commission
        </Link>

        <header className="mt-6 border-b border-zinc-800 pb-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400">
            Finance OS / Refund review
          </p>
          <h1 className="mt-2 text-4xl font-bold">Refund review center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Paid hotel, transfer, activity and personal-service bookings that may require refund or payment reconciliation are reviewed here.
            This workflow records finance review state only. It never issues an M-Pesa reversal, Stripe refund, or changes payment truth by itself.
          </p>
        </header>

        {queryErrors.length ? (
          <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">
            One or more financial sources could not be loaded. Counts may be incomplete.
          </div>
        ) : null}

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Open reviews" value={pending.length} />
          <Metric label="Hotels" value={pending.filter(x=>x.product==="hotel").length} />
          <Metric label="Transfers" value={pending.filter(x=>x.product==="transfer").length} />
          <Metric label="Activities" value={pending.filter(x=>x.product==="activity").length} />
          <Metric label="Services" value={pending.filter(x=>x.product==="service").length} />
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Needs finance review</p>
              <h2 className="mt-2 text-2xl font-semibold">Open refund cases</h2>
            </div>
            <span className="rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-400">
              Money movement disabled here
            </span>
          </div>

          {!pending.length ? (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-500">
              No refund or payment-reconciliation cases currently require review.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {pending.map(item=>{
                const review=reviewByKey.get(`${item.product}:${item.ledgerId}`);
                return <article key={`${item.product}:${item.ledgerId}`} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                        {item.product} · {item.provider}
                      </p>
                      <p className="mt-2 font-mono text-xs text-zinc-400">{item.ledgerId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{item.currency} {item.amount.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.bookingStatus} · {item.refundStatus}</p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-xl bg-black p-4 text-sm leading-6 text-zinc-400">{item.reason}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Meta label="Payment" value={item.paymentStatus} />
                    <Meta label="Customer user" value={item.customerUserId} />
                  </div>
                  <RefundReviewActions
                    product={item.product}
                    ledgerId={item.ledgerId}
                    provider={item.provider}
                    reason={item.reason}
                    review={review ? {
                      id:review.id,
                      status:review.status,
                      resolution:review.resolution,
                      notes:review.notes,
                    } : null}
                  />
                </article>;
              })}
            </div>
          )}
        </section>

        {resolved.length ? (
          <section className="mt-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Completed review</p>
            <h2 className="mt-2 text-2xl font-semibold">Resolved finance cases</h2>
            <div className="mt-5 space-y-3">
              {resolved.slice(0,50).map(item=>{
                const review=reviewByKey.get(`${item.product}:${item.ledgerId}`)!;
                return <div key={review.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div>
                    <p className="font-semibold capitalize">{item.product} · {item.provider}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">{item.ledgerId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{item.currency} {item.amount.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-emerald-400">{String(review.resolution||"resolved").replaceAll("_"," ")}</p>
                  </div>
                </div>;
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-10 rounded-2xl border border-amber-900/30 bg-amber-950/10 p-6">
          <p className="font-semibold text-amber-200">Financial truth remains separate</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            A review may conclude that a refund is required, not due, or already handled externally.
            None of those review labels changes the ledger payment status. Actual refund execution must use a governed provider-specific reversal workflow and verified callback evidence.
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({label,value}:{label:string;value:number}) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>;
}

function Meta({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl bg-black p-3">
    <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
    <p className="mt-1 break-all text-xs text-zinc-400">{value}</p>
  </div>;
}
