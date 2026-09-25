import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  provider: string;
  prepared_booking_id: string;
  provider_booking_reference: string | null;
  customer_currency: string | null;
  customer_retail_amount: number | null;
  retail_amount: number | null;
  payment_status: string | null;
  booking_status: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default async function AccountHotelsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login?next=/account/hotels");

  const { data, error } = await supabaseAdmin
    .from("hotel_booking_pricing_ledger")
    .select("id,provider,prepared_booking_id,provider_booking_reference,customer_currency,customer_retail_amount,retail_amount,payment_status,booking_status,created_at,metadata")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data || []) as Row[];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-12 text-[#111]">
      <section className="mx-auto max-w-4xl">
        <Link href="/account" className="text-sm font-semibold">← My SafariPlug</Link>
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[.22em] text-black/35">Stays</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">My hotel bookings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
          These are real SafariPlug hotel checkout records. Supplier booking references appear only after confirmation.
        </p>

        <div className="mt-8 space-y-3">
          {rows.map((row) => {
            const metadata = row.metadata || {};
            const hotelName = String(metadata.hotelName || "Hotel stay");
            const checkIn = String(metadata.checkIn || "");
            const checkOut = String(metadata.checkOut || "");
            const amount = Number(row.customer_retail_amount ?? row.retail_amount ?? 0);
            const currency = row.customer_currency || "KES";
            const provider = row.provider === "hotelbeds" ? "hotelbeds" : "locktrip";
            const bookingHref = `/hotels/booking-result?provider=${provider}&bookingId=${encodeURIComponent(row.prepared_booking_id)}`;

            return (
              <article key={row.id} className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{hotelName}</p>
                    {checkIn || checkOut ? (
                      <p className="mt-1 text-sm text-black/50">{checkIn || "—"} → {checkOut || "—"}</p>
                    ) : null}
                    <p className="mt-2 text-xs uppercase tracking-wider text-black/35">
                      {(row.booking_status || "pending").replaceAll("_", " ")} · payment {row.payment_status || "pending"} · {provider}
                    </p>
                    <p className="mt-2 text-xs text-black/45">{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{currency} {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <p className="mt-1 text-xs text-black/45">Ref: {row.provider_booking_reference || "pending"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={bookingHref} className="inline-flex rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">
                    Open booking
                  </Link>
                  <Link href="/hotels" className="inline-flex rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold">
                    Find another hotel
                  </Link>
                </div>
              </article>
            );
          })}

          {!rows.length ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-black/50">
              You do not have any hotel checkout records yet.
              <div className="mt-4">
                <Link href="/hotels" className="inline-flex rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">
                  Search live hotels
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
