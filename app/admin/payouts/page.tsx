import { redirect } from "next/navigation";
import { getAdminRole, isFinanceAdminRole, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import PayoutActions from "./PayoutActions";
import PayoutReconciliationSweep from "./PayoutReconciliationSweep";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const adminRole = await getAdminRole(adminUser.id);
  const canManageFinance = isFinanceAdminRole(adminRole);

  const { data: payouts } = await supabaseAdmin
    .from("service_provider_payouts")
    .select("id,appointment_id,service_profile_id,provider_user_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,payout_provider,payout_reference,payout_destination_phone,payout_destination_verified_at,eligible_at,approved_at,approved_by,approval_user_id,processing_at,paid_at,failure_reason,conversation_id,originator_conversation_id,mpesa_result_code,mpesa_result_description,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: reconciliationEvents } = await supabaseAdmin
    .from("admin_telemetry_logs")
    .select("id,action_type,metadata,created_at")
    .in("action_type",["service_provider_payout_callback_unmatched","service_provider_payout_callback_applied","service_provider_payout_timeout_reconciliation","service_provider_payout_reconciled","service_provider_payout_stale_processing"])
    .order("created_at",{ascending:false})
    .limit(30);

  const rows = payouts ?? [];
  const counts = rows.reduce((a: Record<string, number>, p: { status: string }) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
  const money = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-2 text-xs uppercase tracking-[0.28em] text-white/45">Finance</p><h1 className="text-4xl font-semibold tracking-tight">Provider payouts</h1><p className="mt-3 max-w-2xl text-sm text-white/55">Review provider earnings, approve them, and release approved KES payouts through M-Pesa. Refunds, disputes, and invalid appointment states automatically block or flag payouts before release.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4 text-sm"><span className="text-white/45">Total shown</span><span className="ml-3 font-medium">{rows.length}</span></div>{!canManageFinance?<span className="rounded-full border border-amber-700/50 bg-amber-950/20 px-3 py-1.5 text-xs font-semibold text-amber-300">Read only · finance role required</span>:null}</div>
        </div>
        <div className="mb-5"><PayoutReconciliationSweep canManageFinance={canManageFinance} /></div>
        <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(["eligible","approved","processing","paid","failed","held"] as const).map((s) => <div key={s} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs uppercase tracking-wider text-white/40">{s}</div><div className="mt-2 text-2xl font-semibold">{counts[s] || 0}</div></div>)}
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
          <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="border-b border-white/10 bg-white/[.035] text-xs uppercase tracking-wider text-white/40"><tr><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Appointment</th><th className="px-5 py-4">Gross</th><th className="px-5 py-4">SafariPlug</th><th className="px-5 py-4">Provider net</th><th className="px-5 py-4">Destination</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Approval</th><th className="px-5 py-4">M-Pesa ref</th><th className="px-5 py-4">Risk / hold reason</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((p: any) => <tr key={p.id} className="hover:bg-white/[.025]"><td className="px-5 py-5 font-medium">{p.provider_user_id?.slice(0, 8) || "—"}</td><td className="px-5 py-5 font-mono text-xs text-white/55">{p.appointment_id?.slice(0, 8) || "—"}</td><td className="px-5 py-5">{money(p.gross_amount,p.currency)}</td><td className="px-5 py-5">{money(p.platform_fee_amount,p.currency)} <span className="text-white/35">({p.platform_fee_percent}%)</span></td><td className="px-5 py-5 font-medium">{money(p.provider_net_amount,p.currency)}</td><td className="px-5 py-5 text-xs">{p.payout_destination_phone ? `${p.payout_destination_phone}${p.payout_destination_verified_at ? " · verified" : " · unverified"}` : "Not configured"}</td><td className="px-5 py-5"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{p.status}</span></td><td className="px-5 py-5 text-xs text-white/55">{p.approved_by ? <><span className="font-mono">{p.approved_by.slice(0,8)}</span>{p.approved_at ? <span className="mt-1 block text-[10px] text-white/35">{new Date(p.approved_at).toLocaleString()}</span> : null}</> : "—"}</td><td className="px-5 py-5 font-mono text-xs text-white/50">{p.payout_reference || "—"}</td><td className="max-w-[280px] px-5 py-5 text-xs leading-5 text-white/55">{p.failure_reason || "—"}</td><td className="px-5 py-5"><PayoutActions payoutId={p.id} status={p.status} canManageFinance={canManageFinance} /></td></tr>)}</tbody></table>{rows.length === 0 && <div className="p-16 text-center text-sm text-white/45">No provider payouts yet. Completed, paid appointments will appear here when they become eligible.</div>}</div>
        </div>
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6">
          <div className="mb-4"><p className="text-xs uppercase tracking-[.2em] text-white/40">Reconciliation trail</p><h2 className="mt-1 text-xl font-semibold">Recent M-Pesa payout events</h2></div>
          <div className="space-y-3">{(reconciliationEvents??[]).map((event:any)=><div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{event.action_type}</span><span className="text-xs text-white/35">{new Date(event.created_at).toLocaleString()}</span></div><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/45">{JSON.stringify(event.metadata,null,2)}</pre></div>)}{(reconciliationEvents??[]).length===0&&<p className="text-sm text-white/45">No payout reconciliation events recorded yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}
