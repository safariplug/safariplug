import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminLogoutButton from "./logout-button";

export const dynamic = "force-dynamic";
const payoutAction = new Set(["eligible", "approved", "processing", "held"]);

export default async function AdminHome() {
  let adminUser;
  try { adminUser = await requireAdmin(); } catch { redirect("/admin/login"); }

  const [prospects, invites, suppliers, payouts, events, travelerVerification] = await Promise.all([
    supabaseAdmin.from("ai_sales_prospects").select("id,business_name,status,city,created_at").order("created_at", { ascending: false }).limit(6),
    supabaseAdmin.from("partner_invitations").select("id,business_name,status,created_at").order("created_at", { ascending: false }).limit(6),
    supabaseAdmin.from("supplier_accounts").select("id,onboarding_status,completion_percent,created_at,businesses(name)").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("service_provider_payouts").select("id,status,currency,provider_net_amount,created_at").order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("ai_discovered_events").select("id,title,status,confidence_score,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("verification_cases").select("id,status").eq("subject_type", "traveler").in("status", ["not_started","pending","in_review"]).limit(250),
  ]);

  const p = prospects.data || [];
  const i = invites.data || [];
  const s = suppliers.data || [];
  const f = payouts.data || [];
  const e = events.data || [];
  const inviteActions = i.filter(x => ["draft", "ready_for_approval", "approved"].includes(x.status));
  const supplierActions = s.filter(x => !["approved", "live"].includes(x.onboarding_status));
  const payoutActions = f.filter(x => payoutAction.has(x.status));
  const travelerTrustActions = travelerVerification.data || [];
  const attention = inviteActions.length + supplierActions.length + payoutActions.length + e.length + travelerTrustActions.length;
  const queryErrors = [prospects.error, invites.error, suppliers.error, payouts.error, events.error, travelerVerification.error].filter(Boolean);

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <header className="border-b border-zinc-800 pb-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-amber-400">SafariPlug // Business OS</p><h1 className="mt-2 text-4xl font-bold">Command Center</h1><p className="mt-3 max-w-3xl text-sm text-zinc-400">Live operating view for growth, partner operations, marketplace finance, curation and marketing.</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">Signed in as {adminUser.email || "SafariPlug admin"}</span><AdminLogoutButton /></div></div><div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-right"><p className="text-xs text-zinc-500">Needs attention</p><p className="text-2xl font-bold text-amber-300">{attention}</p></div></div></header>

    {queryErrors.length > 0 && <section className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/20 p-4"><p className="font-semibold text-red-300">Operational data is partially unavailable</p><p className="mt-1 text-sm text-red-300/70">One or more dashboard queries failed. Open the source workspace before acting on the affected metric.</p></section>}

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><Metric label="Recent AI prospects" value={p.length} href="/admin/crm"/><Metric label="Invites need action" value={inviteActions.length} href="/admin/ai-sales/invitations"/><Metric label="Supplier onboarding" value={supplierActions.length} href="/admin/suppliers"/><Metric label="Payout actions" value={payoutActions.length} href="/admin/payouts"/><Metric label="Events pending" value={e.length} href="/admin/ai-events"/><Metric label="Traveler verification" value={travelerTrustActions.length} href="/admin/integrations/verification"/></section>

    <section className="mt-8"><div className="mb-4"><h2 className="text-xl font-semibold">Action queue</h2><p className="mt-1 text-sm text-zinc-500">Human-governed work that should be reviewed before external or financial action.</p></div><div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
      <Queue title="Partner recruitment" href="/admin/ai-sales/invitations" count={inviteActions.length} text="Draft, approval-ready or approved invitations awaiting the next governed step."/>
      <Queue title="Supplier activation" href="/admin/suppliers" count={supplierActions.length} text="Supplier accounts not yet approved or live."/>
      <Queue title="Provider payouts" href="/admin/payouts" count={payoutActions.length} text="Eligible, approved, processing or held payout records."/>
      <Queue title="Event curation" href="/admin/ai-events" count={e.length} text="AI-discovered events waiting for human review."/><Queue title="Traveler trust" href="/admin/integrations/verification" count={travelerTrustActions.length} text="Traveler identity/liveness cases awaiting completion or provider review."/>
    </div></section>

    <section className="mt-8 grid gap-5 lg:grid-cols-2"><Panel title="Growth pulse" href="/admin/crm">{p.length ? p.slice(0,5).map(x => <Link key={x.id} href={`/admin/ai-sales/edit/${x.id}`} className="flex justify-between gap-4 border-t border-zinc-900 py-3 text-sm"><div><p className="font-medium">{x.business_name}</p><p className="text-xs text-zinc-500">{x.city || "City not recorded"}</p></div><span className="text-xs capitalize text-amber-300">{x.status.replaceAll("_", " ")}</span></Link>) : <Empty text="No recent AI prospects."/>}</Panel>
      <Panel title="Curation pulse" href="/admin/ai-events">{e.length ? e.slice(0,5).map(x => <Link key={x.id} href={`/admin/ai-events/edit/${x.id}`} className="flex justify-between gap-4 border-t border-zinc-900 py-3 text-sm"><p className="font-medium">{x.title}</p><span className="text-xs text-zinc-500">{x.confidence_score == null ? "Review" : `${Math.round(Number(x.confidence_score) * (Number(x.confidence_score) <= 1 ? 100 : 1))}% confidence`}</span></Link>) : <Empty text="No events waiting for review."/>}</Panel>
    </section>

    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Module label="Growth" title="AI CRM" text="Discover prospects, approve outreach, invite partners, track enrollment and open Partner 360." href="/admin/crm"/><Module label="Finance" title="Accounting & Commission" text="Sales, commissions, payables, payouts, refunds, reconciliation and reports from recorded money." href="/admin/accounting"/><Module label="Partner operations" title="Partner 360 & Enrollment" text="Onboarding, verification, activation readiness and supplier relationships." href="/admin/ai-sales/partners"/><Module label="Curation" title="Event Discovery & Approval" text="Review AI-discovered events, verify details and approve listings." href="/admin/ai-events"/><Module label="Marketing" title="Amani Studio" text="Create human-reviewed promotional drafts for SafariPlug campaigns." href="/admin/marketing"/><Module label="Marketplace" title="Supplier Review" text="Review supplier onboarding and governed marketplace activation." href="/admin/suppliers"/><Module label="Payouts" title="Provider Payouts" text="Review provider earnings and governed payout status." href="/admin/payouts"/><Module label="Integrations" title="Travel Integrations" text="Aurelian, hotel, transfer and provider integration foundations." href="/admin/integrations"/><Module label="Trust & safety" title="Verification Operations" text="Monitor traveler, driver, Local and provider identity/liveness cases without manually inventing external verification approval." href="/admin/integrations/verification"/><Module label="Intelligence" title="AI Event Scout" text="Run and review SafariPlug event discovery intelligence." href="/admin/ai-scout"/></section>

    <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold">Operating principle</h2><p className="mt-2 text-sm text-zinc-500">AI discovers, researches and drafts. People approve external outreach, verification, activation and financial actions. Quotes and payment intents are not completed sales.</p></section>
  </div></main>;
}

function Metric({label,value,href}:{label:string;value:number;href:string}){return <Link href={href} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-amber-500/40"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></Link>}
function Queue({title,count,text,href}:{title:string;count:number;text:string;href:string}){return <Link href={href} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-amber-500/40"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-300">{count}</span></div><p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p></Link>}
function Panel({title,href,children}:{title:string;href:string;children:React.ReactNode}){return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="mb-3 flex justify-between gap-4"><h2 className="font-semibold">{title}</h2><Link href={href} className="text-sm text-amber-400">View all →</Link></div>{children}</section>}
function Empty({text}:{text:string}){return <p className="border-t border-zinc-900 py-5 text-sm text-zinc-500">{text}</p>}
function Module({label,title,text,href}:{label:string;title:string;text:string;href:string}){return <Link href={href} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-amber-500/40"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">{label}</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-3 min-h-16 text-sm leading-6 text-zinc-500">{text}</p><p className="mt-5 text-sm font-semibold text-amber-400">Open →</p></Link>}
