import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const STALE_MINUTES = 30;

function ageMinutes(value: string | null) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : null;
}

export default async function AgentHealthPage() {
  await requireAdmin();

  const [aiScout, supplierScout, followupRuns] = await Promise.all([
    supabaseAdmin.from("ai_scout_runs")
      .select("id,location,category,status,queued_at,started_at,completed_at,worker_stage,provider_status,last_error,discoveries_found,sent_for_review")
      .order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("supplier_scout_jobs")
      .select("id,city,category,status,queued_at,claimed_at,completed_at,provider_status,last_error,qualified_count,contact_ready_count,inserted_count")
      .order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("supplier_followup_prep_runs")
      .select("id,status,checked_count,prepared_count,skipped_count,error_message,started_at,completed_at")
      .order("started_at", { ascending: false }).limit(20),
  ]);

  const aiRows = aiScout.data || [];
  const supplierRows = supplierScout.data || [];
  const followups = followupRuns.data || [];
  const errors = [aiScout.error, supplierScout.error, followupRuns.error].filter(Boolean);

  const staleAi = aiRows.filter((row: any) => {
    if (!["queued","running"].includes(String(row.status))) return false;
    const age = ageMinutes(row.started_at || row.queued_at);
    return age !== null && age >= STALE_MINUTES;
  });
  const staleSupplier = supplierRows.filter((row: any) => {
    if (!["queued","running"].includes(String(row.status))) return false;
    const age = ageMinutes(row.claimed_at || row.queued_at);
    return age !== null && age >= STALE_MINUTES;
  });
  const failedAi = aiRows.filter((row: any) => row.status === "failed");
  const failedSupplier = supplierRows.filter((row: any) => row.status === "failed");
  const activeAi = aiRows.filter((row: any) => ["queued","running"].includes(String(row.status)));
  const activeSupplier = supplierRows.filter((row: any) => ["queued","running"].includes(String(row.status)));

  const config = [
    { label: "AI Scout cron auth", ok: Boolean(process.env.CRON_SECRET), detail: Boolean(process.env.CRON_SECRET) ? "CRON_SECRET configured." : "CRON_SECRET missing." },
    { label: "Supplier automation", ok: process.env.SUPPLIER_SCOUT_AUTOMATION_ENABLED === "true", detail: process.env.SUPPLIER_SCOUT_AUTOMATION_ENABLED === "true" ? "Autonomous supplier scouting enabled." : "Automation paused by environment flag." },
    { label: "Supplier worker auth", ok: Boolean(process.env.CRON_SECRET), detail: Boolean(process.env.CRON_SECRET) ? "Worker can authenticate." : "Worker cannot authenticate." },
  ];

  const issues: string[] = [];
  if (!config[0].ok) issues.push("AI Scout schedule/worker authentication is not configured.");
  if (!config[1].ok) issues.push("Supplier Scout automation is paused.");
  if (!config[2].ok) issues.push("Supplier Scout worker authentication is not configured.");
  if (staleAi.length) issues.push(String(staleAi.length) + " AI Scout job(s) are stale for 30+ minutes.");
  if (staleSupplier.length) issues.push(String(staleSupplier.length) + " Supplier Scout job(s) are stale for 30+ minutes.");
  if (failedAi.length) issues.push(String(failedAi.length) + " recent AI Scout job(s) failed.");
  if (failedSupplier.length) issues.push(String(failedSupplier.length) + " recent Supplier Scout job(s) failed.");
  if (errors.length) issues.push("One or more agent health database queries failed.");

  const latestFollowup: any = followups[0] || null;

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <header className="border-b border-zinc-800 pb-7">
      <Link href="/admin" className="text-sm text-amber-400">← Command Center</Link>
      <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Agent operations</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-4xl font-semibold">Agent Health</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Live queue, worker and outcome visibility for SafariPlug discovery and supplier-growth agents. This reports real database state and never invents agent activity.</p></div>
        <span className={"rounded-full px-4 py-2 text-xs font-bold uppercase " + (issues.length ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300")}>{issues.length ? "Needs attention" : "Healthy"}</span>
      </div>
    </header>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="AI Scout active" value={activeAi.length}/>
      <Metric label="Supplier Scout active" value={activeSupplier.length}/>
      <Metric label="Stale jobs" value={staleAi.length + staleSupplier.length} alert={staleAi.length + staleSupplier.length > 0}/>
      <Metric label="Recent failures" value={failedAi.length + failedSupplier.length} alert={failedAi.length + failedSupplier.length > 0}/>
    </section>

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="text-xl font-semibold">Configuration</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{config.map(item => <Config key={item.label} {...item}/>)}</div>
    </section>

    {issues.length > 0 && <section className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-5">
      <h2 className="font-semibold text-amber-200">Needs attention</h2>
      <ul className="mt-3 space-y-2 text-sm text-amber-100/70">{issues.map(item => <li key={item}>• {item}</li>)}</ul>
    </section>}

    <section className="mt-8 grid gap-5 xl:grid-cols-2">
      <AgentPanel title="AI Scout">
        {aiRows.slice(0,12).map((row:any) => <Job key={row.id} title={String(row.location) + " · " + String(row.category)} status={String(row.status)} detail={row.status === "completed" ? String(row.discoveries_found || 0) + " candidates · " + String(row.sent_for_review || 0) + " sent for review" : row.last_error || row.worker_stage || row.provider_status || "No detail"} age={ageMinutes(row.started_at || row.queued_at)}/>)}
        {!aiRows.length && <Empty text="No AI Scout job history."/>}
      </AgentPanel>

      <AgentPanel title="Supplier Scout">
        {supplierRows.slice(0,12).map((row:any) => <Job key={row.id} title={String(row.city) + " · " + String(row.category)} status={String(row.status)} detail={row.status === "completed" ? String(row.qualified_count || 0) + " qualified · " + String(row.contact_ready_count || 0) + " contact-ready · " + String(row.inserted_count || 0) + " inserted" : row.last_error || row.provider_status || "No detail"} age={ageMinutes(row.claimed_at || row.queued_at)}/>)}
        {!supplierRows.length && <Empty text="No Supplier Scout job history."/>}
      </AgentPanel>
    </section>

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="font-semibold">Supplier follow-up preparation</h2>
      <p className="mt-1 text-sm text-zinc-500">Draft preparation only; external sending remains human-governed.</p>
      {latestFollowup ? <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Checked" value={Number(latestFollowup.checked_count || 0)}/>
        <Metric label="Prepared" value={Number(latestFollowup.prepared_count || 0)}/>
        <Metric label="Skipped" value={Number(latestFollowup.skipped_count || 0)}/>
        <Metric label="Runs loaded" value={followups.length}/>
      </div> : <Empty text="No supplier follow-up preparation runs recorded yet."/>}
      {latestFollowup?.error_message ? <p className="mt-4 text-sm text-red-300">{latestFollowup.error_message}</p> : null}
    </section>
  </div></main>;
}

function Metric({label,value,alert=false}:{label:string;value:number;alert?:boolean}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className={"mt-2 text-3xl font-bold " + (alert ? "text-amber-300" : "text-white")}>{value}</p></div>}
function Config({label,ok,detail}:{label:string;ok:boolean;detail:string}){return <div className="rounded-xl border border-zinc-800 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{label}</p><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase " + (ok ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300")}>{ok ? "ready" : "attention"}</span></div><p className="mt-2 text-sm text-zinc-500">{detail}</p></div>}
function AgentPanel({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold">{title}</h2><div className="mt-3 divide-y divide-zinc-900">{children}</div></section>}
function Job({title,status,detail,age}:{title:string;status:string;detail:string;age:number|null}){return <div className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p>{age !== null && ["queued","running"].includes(status) ? <p className="mt-1 text-[10px] text-zinc-600">{age}m in current state</p> : null}</div><span className={"text-[10px] font-bold uppercase " + (status === "failed" ? "text-red-300" : status === "completed" ? "text-emerald-300" : "text-amber-300")}>{status}</span></div></div>}
function Empty({text}:{text:string}){return <p className="py-5 text-sm text-zinc-500">{text}</p>}
