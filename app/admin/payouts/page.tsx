import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/admin/login");

  const { data: payouts } = await supabase
    .from("service_provider_payouts")
    .select("id,appointment_id,service_profile_id,provider_user_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,payout_provider,payout_reference,eligible_at,paid_at,failure_reason,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = payouts ?? [];
  const counts = rows.reduce((a: Record<string, number>, p: { status: string }) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
  const money = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-2 text-xs uppercase tracking-[0.28em] text-white/45">Finance</p><h1 className="text-4xl font-semibold tracking-tight">Provider payouts</h1><p className="mt-3 max-w-2xl text-sm text-white/55">Review provider earnings before SafariPlug releases funds through M-Pesa.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4 text-sm"><span className="text-white/45">Total shown</span><span className="ml-3 font-medium">{rows.length}</span></div>
        </div>
        <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(["eligible","approved","processing","paid","failed","held"] as const).map((s) => <div key={s} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs uppercase tracking-wider text-white/40">{s}</div><div className="mt-2 text-2xl font-semibold">{counts[s] || 0}</div></div>)}
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-white/10 bg-white/[.035] text-xs uppercase tracking-wider text-white/40"><tr><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Appointment</th><th className="px-5 py-4">Gross</th><th className="px-5 py-4">SafariPlug</th><th className="px-5 py-4">Provider net</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">M-Pesa ref</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((p: any) => <tr key={p.id} className="hover:bg-white/[.025]"><td className="px-5 py-5 font-medium">{p.provider_user_id?.slice(0, 8) || "—"}</td><td className="px-5 py-5 font-mono text-xs text-white/55">{p.appointment_id?.slice(0, 8) || "—"}</td><td className="px-5 py-5">{money(p.gross_amount,p.currency)}</td><td className="px-5 py-5">{money(p.platform_fee_amount,p.currency)} <span className="text-white/35">({p.platform_fee_percent}%)</span></td><td className="px-5 py-5 font-medium">{money(p.provider_net_amount,p.currency)}</td><td className="px-5 py-5"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{p.status}</span></td><td className="px-5 py-5 font-mono text-xs text-white/50">{p.payout_reference || "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="p-16 text-center text-sm text-white/45">No provider payouts yet. Completed, paid appointments will appear here when they become eligible.</div>}</div>
        </div>
      </div>
    </main>
  );
}
