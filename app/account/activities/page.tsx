import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  prepared_booking_id: string;
  provider_booking_reference: string | null;
  customer_currency: string;
  retail_amount: number;
  payment_status: string;
  booking_status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default async function AccountActivitiesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login?next=/account/activities");

  const { data, error } = await supabaseAdmin
    .from("activity_booking_pricing_ledger")
    .select("id,prepared_booking_id,provider_booking_reference,customer_currency,retail_amount,payment_status,booking_status,created_at,metadata")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data || []) as Row[];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-12 text-[#111]">
      <section className="mx-auto max-w-4xl">
        <Link href="/account" className="text-sm font-semibold">← My SafariPlug</Link>
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[.22em] text-black/35">Activities</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">My activity bookings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
          Hotelbeds activity records appear here after a real checkout is created. A supplier reference is shown only after preconfirmation.
        </p>

        <div className="mt-8 space-y-3">
          {rows.map((row) => {
            const metadata = row.metadata || {};
            const activity =
              metadata.activity && typeof metadata.activity === "object"
                ? metadata.activity as Record<string, unknown>
                : {};
            return (
              <article key={row.id} className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{String(activity.name || "Hotelbeds activity")}</p>
                    <p className="mt-1 text-xs text-black/45">{String(activity.modalityName || "")}</p>
                    <p className="mt-2 text-xs uppercase tracking-wider text-black/35">
                      {row.booking_status.replaceAll("_", " ")} · payment {row.payment_status}
                    </p>
                    <p className="mt-2 text-xs text-black/45">{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{row.customer_currency} {Number(row.retail_amount).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-black/45">Ref: {row.provider_booking_reference || "pending"}</p>
                  </div>
                </div>
                <Link
                  href={`/activities/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(row.prepared_booking_id)}`}
                  className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white"
                >
                  Open booking
                </Link>
              </article>
            );
          })}
          {!rows.length ? <div className="rounded-2xl bg-white p-6 text-sm text-black/50">You do not have any Hotelbeds activity checkout records yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
