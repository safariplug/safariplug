export default function ServiceEconomicsPanel({ feePercent = 10, feeMinimum = 30, customerFeePercent = 0, payoutMinimum = 1000, payoutSchedule = "weekly" }: { feePercent?: number; feeMinimum?: number; customerFeePercent?: number; payoutMinimum?: number; payoutSchedule?: string }) {
  return (
    <section className="rounded-[2rem] bg-black p-7 text-white shadow-[0_20px_80px_-60px_rgba(0,0,0,.7)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-white/40">Marketplace economics</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Simple for customers. Clear for you.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">SafariPlug currently keeps mandatory customer booking fees at zero and funds the marketplace primarily through the provider commission.</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">Launch policy</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Metric label="Provider fee" value={`${feePercent}%`} detail={`KES ${feeMinimum.toLocaleString()} minimum`} />
        <Metric label="Customer fee" value={`${customerFeePercent}%`} detail="No mandatory booking fee" />
        <Metric label="Payout minimum" value={`KES ${payoutMinimum.toLocaleString()}`} detail="Before settlement" />
        <Metric label="Payout cadence" value={payoutSchedule === "weekly" ? "Weekly" : "Manual"} detail="Subject to verification" />
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl bg-white/[.07] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/35">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/45">{detail}</p></div>;
}
