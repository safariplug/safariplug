import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadProductionOpsSnapshot } from "@/lib/ops/production-ops";

export const dynamic="force-dynamic";

export default async function ProductionOpsPage(){
  await requireAdmin();
  const snapshot=await loadProductionOpsSnapshot();
  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-7">
      <div><Link href="/admin" className="text-sm text-amber-400">← Command Center</Link><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Production operations</p><h1 className="mt-2 text-4xl font-semibold">Marketplace health</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">One operating view for booking/payment failures, stale payment states and integration telemetry. This is live database state, not synthetic health.</p></div><p className="text-xs text-zinc-500">Generated {new Date(snapshot.generatedAt).toLocaleString()}</p>
    </div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <Metric label="Travel attempts 24h" value={snapshot.summary.travelVolume}/>
      <Metric label="Paid travel" value={snapshot.summary.paidTravel}/>
      <Metric label="Confirmed travel" value={snapshot.summary.confirmedTravel}/>
      <Metric label="Service attempts 24h" value={snapshot.summary.serviceVolume}/>
      <Metric label="Paid services" value={snapshot.summary.servicePaid}/>
      <Metric label="Food orders 24h" value={snapshot.summary.foodVolume}/>
      <Metric label="Critical alerts" value={snapshot.summary.critical} tone={snapshot.summary.critical?"critical":"ok"}/>
      <Metric label="Warnings" value={snapshot.summary.warning} tone={snapshot.summary.warning?"warning":"ok"}/>
    </section>

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-500">Needs attention</p><h2 className="mt-1 text-2xl font-semibold">Operational alerts</h2></div><span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{snapshot.alerts.length} alert type{snapshot.alerts.length===1?"":"s"}</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{snapshot.alerts.map(alert=><Link key={alert.title} href={alert.href} className={"rounded-xl border p-4 "+(alert.severity==="critical"?"border-red-900 bg-red-950/20":alert.severity==="warning"?"border-amber-900 bg-amber-950/20":"border-zinc-800")}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-zinc-500">{alert.area}</p><h3 className="mt-1 font-semibold">{alert.title}</h3></div><span className="text-2xl font-bold">{alert.count}</span></div><p className="mt-2 text-xs leading-5 text-zinc-400">{alert.detail}</p></Link>)}</div>
      {!snapshot.alerts.length&&<div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-5 text-sm text-emerald-300">No payment, booking or integration alert rules are currently firing for the last 24 hours.</div>}
    </section>

    <section className="mt-8 grid gap-5 xl:grid-cols-2">
      <Panel title="Paid but not confirmed" rows={snapshot.recent.paidNotConfirmed}/>
      <Panel title="Stale pending travel payments" rows={snapshot.recent.stalePending}/>
      <Panel title="Failed travel payments" rows={snapshot.recent.paymentFailed}/>
      <Panel title="Failed travel bookings" rows={snapshot.recent.bookingFailed}/>
    </section>
  </div></main>
}
function Metric({label,value,tone="normal"}:{label:string;value:number;tone?:"normal"|"critical"|"warning"|"ok"}){const cls=tone==="critical"?"text-red-300":tone==="warning"?"text-amber-300":tone==="ok"?"text-emerald-300":"text-white";return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className={"mt-2 text-3xl font-bold "+cls}>{value}</p></div>}
function Panel({title,rows}:{title:string;rows:any[]}){return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400">{rows.length}</span></div><div className="mt-3 divide-y divide-zinc-900">{rows.slice(0,10).map((row:any)=><div key={row.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{row.kind||row.provider||"Travel"}</p><span className="text-[10px] uppercase text-zinc-500">{row.payment_status||"—"} · {row.booking_status||row.status||"—"}</span></div><p className="mt-1 font-mono text-[10px] text-zinc-600">{row.id}</p></div>)}{!rows.length&&<p className="py-5 text-sm text-zinc-500">None.</p>}</div></section>}
