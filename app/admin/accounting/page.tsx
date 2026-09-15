import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
type Payout={id:string;currency:string;gross_amount:number;platform_fee_amount:number;processor_fee_amount:number;refund_amount:number;provider_net_amount:number;status:string;created_at:string};
type PaymentIntent={id:string;currency:string;amount:number;status:string;provider:string;created_at:string};
const money=(n:number,c:string)=>`${c} ${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default async function AccountingPage(){
 try{await requireAdmin();}catch{redirect("/admin/login");}
 const [payoutsResult,paymentsResult]=await Promise.all([
  supabaseAdmin.from("service_provider_payouts").select("id,currency,gross_amount,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,created_at").order("created_at",{ascending:false}).limit(250),
  supabaseAdmin.from("trip_package_payment_intents").select("id,currency,amount,status,provider,created_at").order("created_at",{ascending:false}).limit(100),
 ]);
 const payouts=(payoutsResult.data||[]) as Payout[];
 const payments=(paymentsResult.data||[]) as PaymentIntent[];
 const currencies=[...new Set(payouts.map(x=>x.currency))];
 return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
  <header className="border-b border-zinc-800 pb-7"><p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-emerald-400">SafariPlug // Finance OS</p><h1 className="mt-2 text-4xl font-bold">Accounting & Commission Ledger</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Real recorded marketplace money only. Revenue, SafariPlug fees, processor fees, refunds and provider liabilities are shown from existing payment and payout records. No estimated FX and no invented revenue.</p></header>
  <section className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Card title="Recorded payout rows" value={String(payouts.length)} text="Provider payout ledger"/><Card title="Package payment intents" value={String(payments.length)} text="Orchestration records, not booked revenue"/><Card title="Paid payouts" value={String(payouts.filter(x=>x.status==="paid").length)} text="Completed provider disbursements"/><Card title="Outstanding payouts" value={String(payouts.filter(x=>["eligible","approved","processing","held"].includes(x.status)).length)} text="Provider liability workflow"/></section>
  <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Marketplace economics by currency</h2><p className="mt-1 text-sm text-zinc-500">Currencies stay separate. SafariPlug does not fabricate exchange rates.</p></div><Link href="/admin/payouts" className="text-sm font-semibold text-emerald-400">Open payout operations →</Link></div>
   <div className="mt-5 grid gap-3 lg:grid-cols-2">{currencies.length?currencies.map(c=>{const rows=payouts.filter(x=>x.currency===c);const sum=(k:keyof Payout)=>rows.reduce((a,x)=>a+Number(x[k]||0),0);return <div key={c} className="rounded-2xl border border-zinc-800 p-5"><div className="flex justify-between"><h3 className="font-semibold">{c}</h3><span className="text-xs text-zinc-500">{rows.length} records</span></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><Money label="Gross" value={money(sum("gross_amount"),c)}/><Money label="SafariPlug fees" value={money(sum("platform_fee_amount"),c)}/><Money label="Processor fees" value={money(sum("processor_fee_amount"),c)}/><Money label="Refunds" value={money(sum("refund_amount"),c)}/><Money label="Provider net" value={money(sum("provider_net_amount"),c)}/></dl></div>}):<p className="text-sm text-zinc-500">No provider payout ledger entries yet.</p>}</div>
  </section>
  <section className="mt-8 grid gap-5 lg:grid-cols-2"><Panel title="Recent commission ledger">{payouts.slice(0,12).map(x=><div key={x.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-zinc-900 py-3 text-sm"><div><p>{money(x.gross_amount,x.currency)} gross</p><p className="text-xs text-zinc-500">SafariPlug {money(x.platform_fee_amount,x.currency)} · provider {money(x.provider_net_amount,x.currency)}</p></div><span className="text-xs text-zinc-400">{x.status}</span></div>)}{!payouts.length&&<Empty/>}</Panel>
  <Panel title="Package payment orchestration">{payments.slice(0,12).map(x=><div key={x.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-zinc-900 py-3 text-sm"><div><p>{money(x.amount,x.currency)}</p><p className="text-xs text-zinc-500">{x.provider}</p></div><span className="text-xs text-zinc-400">{x.status}</span></div>)}{!payments.length&&<Empty/>}</Panel></section>
  <footer className="mt-8 flex flex-wrap gap-4 border-t border-zinc-800 pt-5 text-sm text-zinc-400"><Link href="/admin/crm">← AI CRM</Link><Link href="/admin">Command Center</Link><Link href="/admin/payouts">Payouts</Link></footer>
 </div></main>;
}
function Card({title,value,text}:{title:string;value:string;text:string}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-zinc-600">{text}</p></div>}
function Money({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</section>}
function Empty(){return <p className="border-t border-zinc-900 py-5 text-sm text-zinc-500">No records yet.</p>}
