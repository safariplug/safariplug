import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function LegacyOutreachPage() {
  await requireAdmin();

  const { data: outreach, error } = await supabaseAdmin
    .from("ai_sales_outreach")
    .select(`
      id,
      status,
      approved,
      created_at,
      prospect_id,
      response,
      sent_at,
      follow_up_date,
      follow_up_notes,
      outcome,
      ai_sales_prospects (
        business_name,
        city,
        category,
        opportunity_score,
        contact_email
      )
    `)
    .order("created_at", { ascending: false });

  const rows = outreach ?? [];

  return (
    <main className="min-h-screen bg-[#070707] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-zinc-500">Legacy CRM history</p>
            <h1 className="mt-2 text-4xl font-bold">Legacy outreach records</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              This queue is retained for historical follow-up context only. New outreach must use the governed invitation workflow so drafting, approval, sending, enrollment and Partner 360 stay in one system.
            </p>
          </div>
          <Link href="/admin/ai-sales/invitations" className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black">
            Open governed outreach →
          </Link>
        </div>

        {error ? (
          <div className="mt-7 rounded-2xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-300">
            Legacy outreach history could not be loaded.
          </div>
        ) : null}

        <section className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Historical records</h2>
              <p className="mt-1 text-xs text-zinc-500">{rows.length} legacy record{rows.length === 1 ? "" : "s"} · read only</p>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">No sending from this screen</span>
          </div>

          <div className="mt-5 space-y-3">
            {rows.map((item: any) => {
              const prospect = item.ai_sales_prospects;
              return (
                <article key={item.id} className="rounded-xl border border-zinc-800 bg-black p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{prospect?.business_name || "Unknown prospect"}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {prospect?.city || "City not recorded"} · {prospect?.category || "Uncategorized"} · score {prospect?.opportunity_score ?? "—"}
                      </p>
                    </div>
                    <span className="rounded-full border border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {String(item.status || "unknown").replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
                    <p>Created: {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</p>
                    <p>Sent: {item.sent_at ? new Date(item.sent_at).toLocaleString() : "—"}</p>
                    <p>Follow-up due: {item.follow_up_date ? new Date(item.follow_up_date).toLocaleString() : "—"}</p>
                    <p>Outcome: {item.outcome || "—"}</p>
                  </div>

                  {item.follow_up_notes ? <p className="mt-3 rounded-lg bg-white/[.03] p-3 text-xs leading-5 text-zinc-400">{item.follow_up_notes}</p> : null}
                  {item.response ? <p className="mt-3 rounded-lg bg-white/[.03] p-3 text-xs leading-5 text-zinc-400">{item.response}</p> : null}

                  {item.prospect_id ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/admin/ai-sales/edit/${item.prospect_id}`} className="text-sm font-semibold text-zinc-300">
                        Open Organization 360 →
                      </Link>
                      <Link href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(item.prospect_id)}`} className="text-sm font-semibold text-amber-400">
                        Continue in governed outreach →
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {!error && !rows.length ? (
              <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-600">No legacy outreach records.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
