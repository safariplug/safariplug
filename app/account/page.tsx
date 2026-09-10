import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect(`/login?next=${encodeURIComponent("/account")}`);

  const [trips, foodOrders, appointments, eventBookings, hotelBookings] = await Promise.all([
    countRows(supabase, "trips", "traveler_id", user.id),
    countRows(supabase, "food_orders", "customer_user_id", user.id),
    countRows(supabase, "service_appointments", "customer_user_id", user.id),
    countRows(supabase, "bookings", "traveler_id", user.id),
    countRows(supabase, "hotel_booking_pricing_ledger", "customer_user_id", user.id),
  ]);

  const totalBookings = foodOrders + appointments + eventBookings + hotelBookings;

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#111] text-white">
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-12 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-white/40">SafariPlug</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">My SafariPlug</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
            Your trips, stays, experiences, services and food orders — together in one place.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard href="/trips" label="Trips" value={trips} />
          <StatusCard href="/hotels" label="Hotel bookings" value={hotelBookings} />
          <StatusCard href="/account/appointments" label="Appointments" value={appointments} />
          <StatusCard href="/account/orders" label="Food orders" value={foodOrders} />
          <StatusCard href="/events" label="Experience bookings" value={eventBookings} />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <AccountCard href="/trips" title="My trips" description="Open your itineraries and see hotels, food orders, services and experiences attached to each journey." />
          <AccountCard href="/hotels" title="Hotels" description="Search live stays and manage the hotel booking flow." />
          <AccountCard href="/services" title="Services & appointments" description="Book barbers, massage, beauty, wellness, tattoo, nails and other local services." />
          <AccountCard href="/account/orders" title="Food orders" description="Track restaurant orders, delivery progress, drivers and completed deliveries." />
          <AccountCard href="/events" title="Events & experiences" description="Discover experiences and add them to your trips." />
          <AccountCard href="/concierge" title="AI Concierge" description="Tell SafariPlug what you need and let Concierge help find the right option." />
        </div>

        <section className="mt-8 rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Booking activity</p>
          <h2 className="mt-2 text-2xl font-semibold">{totalBookings ? `${totalBookings} booking${totalBookings === 1 ? "" : "s"} across SafariPlug` : "Nothing booked yet"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
            Once a booking is created, SafariPlug keeps it connected to your account and, where a trip is selected, to the same itinerary.
          </p>
          <Link href="/concierge" className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Plan with Concierge</Link>
        </section>
      </section>
    </main>
  );
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  ownerColumn: string,
  ownerId: string,
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(ownerColumn, ownerId);
  return count ?? 0;
}

function StatusCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </Link>
  );
}

function AccountCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold">{title}</h2>
        <span aria-hidden className="text-black/30 transition group-hover:translate-x-1">↗</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-black/55">{description}</p>
    </Link>
  );
}
