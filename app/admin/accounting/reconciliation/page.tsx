import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";

type Anomaly={
  key:string;
  severity:"critical"|"warning";
  source:string;
  reference:string;
  title:string;
  detail:string;
  updatedAt:string;
};

const settled=new Set(["paid","partially_refunded","refunded","disputed"]);
const money=(value:unknown,currency:string)=>`${currency} ${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default async function ReconciliationPage(){
  await requireAdmin();

  const [
    serviceLedgerResult,
    serviceAppointmentResult,
    foodRefundResult,
    foodOrderResult,
    payoutResult,
    checkoutResult,
    paymentIntentResult,
  ]=await Promise.all([
    supabaseAdmin.from("service_payment_ledger")
      .select("id,appointment_id,status,customer_total_amount,currency,paid_at,payment_reference,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("service_appointments")
      .select("id,public_id,status,payment_status,customer_total_amount,currency,paid_at,payment_reference,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("food_order_refunds")
      .select("id,order_id,provider,amount,currency,status,refund_reference,error_message,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("food_orders")
      .select("id,public_id,status,payment_status,currency,customer_total,refunded_amount,refund_reference,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("service_provider_payouts")
      .select("id,appointment_id,currency,provider_net_amount,status,payout_reference,transaction_receipt,mpesa_transaction_id,paid_at,failure_reason,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("trip_package_checkout_attempts")
      .select("id,status,currency,subtotal,expires_at,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
    supabaseAdmin.from("trip_package_payment_intents")
      .select("id,checkout_attempt_id,trip_id,provider,currency,amount,status,provider_reference,updated_at")
      .order("updated_at",{ascending:false}).limit(1000),
  ]);

  const anomalies:Anomaly[]=[];
  const appointmentsById=new Map((serviceAppointmentResult.data||[]).map(row=>[row.id,row]));
  const ledgerByAppointment=new Map((serviceLedgerResult.data||[]).map(row=>[row.appointment_id,row]));

  for(const ledger of serviceLedgerResult.data||[]){
    const appointment=appointmentsById.get(ledger.appointment_id);
    if(!appointment){
      anomalies.push({
        key:`service-orphan-${ledger.id}`,severity:"critical",source:"Service payment",
        reference:ledger.id,title:"Payment ledger has no appointment",
        detail:`Ledger ${ledger.id} references missing appointment ${ledger.appointment_id}.`,
        updatedAt:ledger.updated_at,
      });
      continue;
    }
    if(String(ledger.status)!==String(appointment.payment_status)){
      anomalies.push({
        key:`service-status-${ledger.id}`,severity:"critical",source:"Service payment",
        reference:appointment.public_id||appointment.id,title:"Payment status mismatch",
        detail:`Appointment says ${appointment.payment_status}; ledger says ${ledger.status}.`,
        updatedAt:ledger.updated_at,
      });
    }
    if(Math.abs(Number(ledger.customer_total_amount||0)-Number(appointment.customer_total_amount||0))>0.01){
      anomalies.push({
        key:`service-amount-${ledger.id}`,severity:"critical",source:"Service payment",
        reference:appointment.public_id||appointment.id,title:"Customer total mismatch",
        detail:`Appointment total ${money(appointment.customer_total_amount,appointment.currency)}; ledger total ${money(ledger.customer_total_amount,ledger.currency)}.`,
        updatedAt:ledger.updated_at,
      });
    }
  }

  for(const appointment of serviceAppointmentResult.data||[]){
    const ledger=ledgerByAppointment.get(appointment.id);
    if(settled.has(String(appointment.payment_status))&&!ledger){
      anomalies.push({
        key:`service-missing-ledger-${appointment.id}`,severity:"critical",source:"Service payment",
        reference:appointment.public_id||appointment.id,title:"Settled appointment has no payment ledger",
        detail:`Appointment payment state is ${appointment.payment_status}, but no service payment ledger row was found.`,
        updatedAt:appointment.updated_at,
      });
    }
    if(["paid","partially_refunded","refunded"].includes(String(appointment.payment_status))&&!appointment.paid_at){
      anomalies.push({
        key:`service-paid-at-${appointment.id}`,severity:"warning",source:"Service payment",
        reference:appointment.public_id||appointment.id,title:"Settled payment is missing paid-at evidence",
        detail:`Payment status is ${appointment.payment_status}, but paid_at is empty.`,
        updatedAt:appointment.updated_at,
      });
    }
    if(appointment.payment_status==="disputed"){
      anomalies.push({
        key:`service-disputed-${appointment.id}`,severity:"warning",source:"Service payment",
        reference:appointment.public_id||appointment.id,title:"Service payment is disputed",
        detail:"This payment requires governed finance reconciliation; do not downgrade or recharge automatically.",
        updatedAt:appointment.updated_at,
      });
    }
  }

  const foodOrdersById=new Map((foodOrderResult.data||[]).map(row=>[row.id,row]));
  const succeededRefundByOrder=new Map<string,number>();
  for(const refund of foodRefundResult.data||[]){
    const order=foodOrdersById.get(refund.order_id);
    if(!order){
      anomalies.push({
        key:`food-orphan-${refund.id}`,severity:"critical",source:"Food refund",
        reference:refund.id,title:"Refund record has no food order",
        detail:`Refund ${refund.id} references missing order ${refund.order_id}.`,
        updatedAt:refund.updated_at,
      });
      continue;
    }
    if(refund.status==="succeeded"){
      succeededRefundByOrder.set(refund.order_id,(succeededRefundByOrder.get(refund.order_id)||0)+Number(refund.amount||0));
      if(order.payment_status!=="refunded"||Number(order.refunded_amount||0)+0.01<Number(refund.amount||0)){
        anomalies.push({
          key:`food-state-${refund.id}`,severity:"critical",source:"Food refund",
          reference:order.public_id||order.id,title:"Successful refund does not match order state",
          detail:`Refund succeeded for ${money(refund.amount,refund.currency)}, while order payment state is ${order.payment_status} and recorded refunded amount is ${money(order.refunded_amount,order.currency)}.`,
          updatedAt:refund.updated_at,
        });
      }
    }
    if(refund.status==="failed"){
      anomalies.push({
        key:`food-failed-${refund.id}`,severity:"warning",source:"Food refund",
        reference:order.public_id||order.id,title:"Food refund failed",
        detail:refund.error_message||"Provider refund failed and requires finance review.",
        updatedAt:refund.updated_at,
      });
    }
  }

  for(const order of foodOrderResult.data||[]){
    if(order.payment_status==="refunded"&&!succeededRefundByOrder.has(order.id)){
      anomalies.push({
        key:`food-missing-refund-${order.id}`,severity:"warning",source:"Food refund",
        reference:order.public_id||order.id,title:"Refunded order lacks a succeeded refund record",
        detail:`Order records ${money(order.refunded_amount,order.currency)} refunded, but no succeeded food_order_refunds row was found in the reconciliation window.`,
        updatedAt:order.updated_at,
      });
    }
    if(order.payment_status==="disputed"){
      anomalies.push({
        key:`food-disputed-${order.id}`,severity:"warning",source:"Food payment",
        reference:order.public_id||order.id,title:"Food order payment is disputed",
        detail:"Payment truth is disputed and requires governed finance review.",
        updatedAt:order.updated_at,
      });
    }
  }

  const dayMs=24*60*60*1000;
  for(const payout of payoutResult.data||[]){
    const evidence=payout.transaction_receipt||payout.mpesa_transaction_id||payout.payout_reference;
    if(payout.status==="paid"&&(!payout.paid_at||!evidence)){
      anomalies.push({
        key:`payout-evidence-${payout.id}`,severity:"critical",source:"Provider payout",
        reference:payout.id,title:"Paid payout is missing completion evidence",
        detail:`${money(payout.provider_net_amount,payout.currency)} is marked paid without both paid_at and a provider/transaction reference.`,
        updatedAt:payout.updated_at,
      });
    }
    if(payout.status==="failed"){
      anomalies.push({
        key:`payout-failed-${payout.id}`,severity:"warning",source:"Provider payout",
        reference:payout.id,title:"Provider payout failed",
        detail:payout.failure_reason||"Failed payout requires operator review. Never retry automatically.",
        updatedAt:payout.updated_at,
      });
    }
    if(payout.status==="processing"&&Date.now()-new Date(payout.updated_at).getTime()>dayMs){
      anomalies.push({
        key:`payout-stale-${payout.id}`,severity:"critical",source:"Provider payout",
        reference:payout.id,title:"Payout has been processing for more than 24 hours",
        detail:"Hold for reconciliation before any retry to avoid duplicate payment.",
        updatedAt:payout.updated_at,
      });
    }
  }

  const checkoutById=new Map((checkoutResult.data||[]).map(row=>[row.id,row]));
  for(const intent of paymentIntentResult.data||[]){
    const checkout=checkoutById.get(intent.checkout_attempt_id);
    if(!checkout){
      anomalies.push({
        key:`package-orphan-${intent.id}`,severity:"critical",source:"Package payment",
        reference:intent.id,title:"Package payment intent has no checkout attempt",
        detail:`Payment intent references missing checkout attempt ${intent.checkout_attempt_id}.`,
        updatedAt:intent.updated_at,
      });
      continue;
    }
    if(intent.status==="succeeded"&&!intent.provider_reference){
      anomalies.push({
        key:`package-reference-${intent.id}`,severity:"critical",source:"Package payment",
        reference:intent.id,title:"Successful package payment lacks provider reference",
        detail:`${money(intent.amount,intent.currency)} is marked succeeded without provider evidence.`,
        updatedAt:intent.updated_at,
      });
    }
    if(["blocked","expired"].includes(String(checkout.status))&&intent.status==="succeeded"){
      anomalies.push({
        key:`package-state-${intent.id}`,severity:"critical",source:"Package payment",
        reference:intent.id,title:"Payment succeeded against a blocked or expired checkout",
        detail:`Checkout state is ${checkout.status}; payment intent is succeeded. Finance reconciliation is required before fulfillment.`,
        updatedAt:intent.updated_at,
      });
    }
    if(checkout.status==="expired"&&intent.status==="processing"){
      anomalies.push({
        key:`package-processing-${intent.id}`,severity:"warning",source:"Package payment",
        reference:intent.id,title:"Payment still processing after checkout expired",
        detail:"Do not create another charge until the provider state is reconciled.",
        updatedAt:intent.updated_at,
      });
    }
  }

  anomalies.sort((a,b)=>{
    if(a.severity!==b.severity)return a.severity==="critical"?-1:1;
    return new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime();
  });

  const critical=anomalies.filter(x=>x.severity==="critical");
  const warnings=anomalies.filter(x=>x.severity==="warning");
  const queryErrors=[
    serviceLedgerResult.error,serviceAppointmentResult.error,foodRefundResult.error,
    foodOrderResult.error,payoutResult.error,checkoutResult.error,paymentIntentResult.error,
  ].filter(Boolean);
  const cappedSources=[
    (serviceLedgerResult.data||[]).length>=1000?"service payment ledger":null,
    (serviceAppointmentResult.data||[]).length>=1000?"service appointments":null,
    (foodRefundResult.data||[]).length>=1000?"food refunds":null,
    (foodOrderResult.data||[]).length>=1000?"food orders":null,
    (payoutResult.data||[]).length>=1000?"provider payouts":null,
    (checkoutResult.data||[]).length>=1000?"package checkout attempts":null,
    (paymentIntentResult.data||[]).length>=1000?"package payment intents":null,
  ].filter((value):value is string=>Boolean(value));

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/accounting" className="font-mono text-xs text-emerald-400 hover:underline">← Accounting & Commission</Link>
      <header className="mt-6 border-b border-zinc-800 pb-7">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400">Finance OS / Reconciliation</p>
        <h1 className="mt-2 text-4xl font-bold">Reconciliation center</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Read-only controls compare recorded payment, refund and payout truth across SafariPlug ledgers. This page flags differences only; it never changes a financial record, retries a payout, creates a charge, or issues a refund.
        </p>
      </header>

      {queryErrors.length?<div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">
        One or more reconciliation sources could not be loaded. A zero anomaly count must not be treated as a clean reconciliation result.
      </div>:null}

      {cappedSources.length?<div className="mt-4 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 text-sm text-amber-200">
        Source row limits were reached for {cappedSources.join(", ")}. Reconciliation is partial and older anomalies may be outside the loaded window.
      </div>:null}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Open anomalies" value={anomalies.length}/>
        <Metric label="Critical" value={critical.length}/>
        <Metric label="Warnings" value={warnings.length}/>
        <Metric label="Sources checked" value={7}/>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Exception queue</p>
            <h2 className="mt-2 text-2xl font-semibold">Financial truth mismatches</h2>
          </div>
          <span className="rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-400">Read only</span>
        </div>

        {!anomalies.length?<div className="mt-5 rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-8">
          <p className="font-semibold text-emerald-300">No reconciliation anomalies detected.</p>
          <p className="mt-2 text-sm text-zinc-500">The checked service payments, food refunds, provider payouts and package payment states are internally consistent in the current query window.</p>
        </div>:<div className="mt-5 space-y-3">
          {anomalies.map(item=><article key={item.key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{item.source}</p>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-2 font-mono text-[10px] text-zinc-600">{item.reference}</p>
              </div>
              <span className={item.severity==="critical"
                ?"rounded-full border border-red-700/50 bg-red-950/20 px-3 py-1 text-xs font-semibold text-red-300"
                :"rounded-full border border-amber-700/50 bg-amber-950/20 px-3 py-1 text-xs font-semibold text-amber-300"}>
                {item.severity}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">{item.detail}</p>
            <p className="mt-3 text-[10px] text-zinc-600">Last source update: {new Date(item.updatedAt).toLocaleString()}</p>
          </article>)}
        </div>}
      </section>

      <section className="mt-10 rounded-2xl border border-amber-900/30 bg-amber-950/10 p-6">
        <p className="font-semibold text-amber-200">Human-governed finance</p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Investigate anomalies against provider evidence before changing payment or payout state. Failed or uncertain money movement is never retried automatically from this center.
        </p>
      </section>
    </div>
  </main>;
}

function Metric({label,value}:{label:string;value:number}){
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>;
}
