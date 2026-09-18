import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import TravelerNav from "@/components/TravelerNav";
import { getTravelerVerificationState } from "@/lib/services/traveler-verification";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect(`/login?next=${encodeURIComponent("/account")}`);

  const [trips, foodOrders, appointments, eventBookings, hotelBookings, transferBookings, activityBookings, localRequests, travelerVerification] = await Promise.all([
    countRows(supabase, "trips", "traveler_id", user.id),
    countRows(supabase, "food_orders", "customer_user_id", user.id),
    countRows(supabase, "service_appointments", "customer_user_id", user.id),
    countRows(supabase, "bookings", "traveler_id", user.id),
    countRows(supabase, "hotel_booking_pricing_ledger", "customer_user_id", user.id),
    countRows(supabase, "transfer_booking_pricing_ledger", "customer_user_id", user.id),
    countRows(supabase, "activity_booking_pricing_ledger", "customer_user_id", user.id),
    countRows(supabase, "local_requests", "traveler_id", user.id),
    getTravelerVerificationState(user.id),
  ]);

  const totalActivity = foodOrders + appointments + eventBookings + hotelBookings + transferBookings + activityBookings + localRequests;
  const firstName = String(user.user_metadata?.full_name || user.email || "Traveler").split(/[ @]/)[0];

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <TravelerNav />
    <section className="bg-[#111] text-white"><div className="mx-auto max-w-6xl px-6 pb-14 pt-12 sm:px-10"><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">My SafariPlug</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Welcome back, {firstName}.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-white/55">One place for your trips, stays, experiences, Local requests, services and restaurant orders.</p><div className="mt-7 flex flex-wrap gap-2"><Link href="/account/trips" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Open my trips</Link><Link href="/concierge" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white">Ask Concierge</Link></div></div></section>

    <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard href="/account/trips" label="Trips" value={trips} description="Journeys and itineraries" />
        <StatusCard href="/account/trips" label="Local requests" value={localRequests} description="Requests and responses" />
        <StatusCard href="/account/appointments" label="Appointments" value={appointments} description="Services you requested" />
        <StatusCard href="/account/orders" label="Food orders" value={foodOrders} description="Restaurant order activity" />
        <StatusCard href="/hotels" label="Hotel bookings" value={hotelBookings} description="Real supplier booking records" />
        <StatusCard href="/account/transfers" label="Transfer bookings" value={transferBookings} description="Supplier transfer checkout records" />
        <StatusCard href="/account/activities" label="Activity bookings" value={activityBookings} description="Hotelbeds activity checkout records" />
        <StatusCard href="/events" label="Experience bookings" value={eventBookings} description="Booked experiences" />
      </div>

      <section className={`mt-8 rounded-[1.75rem] border p-6 shadow-sm ${travelerVerification.verified ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Traveler trust</p><h2 className="mt-2 text-2xl font-semibold">{travelerVerification.verified ? "Identity + live face verification approved" : "Complete identity verification for trust-sensitive bookings"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">{travelerVerification.verified ? "Specific-driver, specific-Local, personal-service, transfer and activity checkout gates can use this approval while it remains valid." : "SafariPlug blocks trust-sensitive bookings until identity and live face/liveness verification is approved."}</p></div><Link href="/account/verification" className="w-fit rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">{travelerVerification.verified ? "Review verification" : "Verify identity →"}</Link></div></section>\n\n      <section className="mt-8 rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Travel activity</p><h2 className="mt-2 text-2xl font-semibold">{totalActivity ? `${totalActivity} active record${totalActivity === 1 ? "" : "s"} across SafariPlug` : "Your SafariPlug is ready"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">SafariPlug shows activity only when a real request, appointment, order or booking exists. Nothing here is generated as fake inventory or a fake reservation.</p></div><Link href="/account/trips" className="w-fit rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">View journeys →</Link></div></section>

      <div className="mt-8"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/35">Explore & manage</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Everything for the trip.</h2></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AccountCard href="/account/verification" title="Identity verification" description="Manage traveler identity and live face/liveness verification for trust-sensitive bookings." />
        <AccountCard href="/account/trips" title="Trips" description="Keep experiences, stays, food, services and Local requests connected to the same journey." />
        <AccountCard href="/locals" title="Locals" description="Find verified, active Local profiles and send a real request for a date, time and activity." />
        <AccountCard href="/hotels" title="Stays" description="Search hotel inventory through configured SafariPlug supplier connections." />
        <AccountCard href="/services" title="Services" description="Find live providers for massage, barbering, beauty, nails, tattoo, fitness, diving and more." />
        <AccountCard href="/restaurants" title="Restaurants & food" description="Browse restaurants with real online ordering enabled and open their live menus." />
        <AccountCard href="/account/transfers" title="Transfer bookings" description="Review Hotelbeds transfer payments, confirmations and cancellations." />
        <AccountCard href="/account/activities" title="Activity bookings" description="Review live Hotelbeds activity payments, confirmations and cancellations." />
        <AccountCard href="/drivers" title="Drivers & transfers" description="Find eligible verified drivers and request transport through SafariPlug." />
        <AccountCard href="/events" title="Events & experiences" description="Discover approved SafariPlug experiences and add the ones you want to your journey." />
        <AccountCard href="/account/saved" title="Saved" description="Return to places and experiences you saved for later." />
        <AccountCard href="/concierge" title="AI Concierge" description="Describe what you need and let SafariPlug route you toward the right marketplace or next step." />
      </div>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-[#111] p-7 text-white"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#c9a86a]">Build the journey</p><h2 className="mt-2 text-2xl font-semibold">Need several things at once?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Start a trip and keep each real SafariPlug request or booking connected to it as the marketplace expands.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/account/trips" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Start or open a trip</Link><Link href="/concierge" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold">Plan with Concierge</Link></div></section>
    </section>
  </main>;
}

async function countRows(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, table: string, ownerColumn: string, ownerId: string) {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(ownerColumn, ownerId);
  return count ?? 0;
}

function StatusCard({ href, label, value, description }: { href: string; label: string; value: number; description: string }) {
  return <Link href={href} className="group rounded-[1.35rem] border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-black/45">{description}</p></div><span className="text-black/25 transition group-hover:translate-x-1">↗</span></div></Link>;
}
function AccountCard({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="group rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold">{title}</h3><span aria-hidden className="text-black/30 transition group-hover:translate-x-1">↗</span></div><p className="mt-2 text-sm leading-6 text-black/55">{description}</p></Link>;
}
