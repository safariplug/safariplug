import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TravelerNav from "@/components/TravelerNav";
import TripItemActions from "./TripItemActions";
import TripPlanTools from "./TripPlanTools";
import TripReorder from "./TripReorder";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/admin/login?next=/account/trips`);
  const { id } = await params;
  const { data: trip } = await supabaseAdmin.from("trips").select("id,title,start_on,end_on,status,created_at").eq("id", id).eq("traveler_id", user.id).maybeSingle();
  if (!trip) notFound();

  const { data: items } = await supabaseAdmin.from("trip_items").select("id,title,start_at,end_at,notes,item_kind,event_id,appointment_id,offering_id,city_id,position").eq("trip_id", id).order("position", { ascending: true });
  const cityIds = [...new Set((items ?? []).map((item) => item.city_id).filter(Boolean))];
  const appointmentIds = [...new Set((items ?? []).map((item) => item.appointment_id).filter(Boolean))];
  const { data: cities } = cityIds.length ? await supabaseAdmin.from("cities").select("id,name,country").in("id", cityIds) : { data: [] };
  const { data: appointments } = appointmentIds.length ? await supabaseAdmin.from("service_appointments").select("id,public_id,status,payment_status,starts_at,ends_at,service_profiles(businesses(name)),service_offerings(name),service_staff(display_name)").in("id", appointmentIds).eq("customer_user_id", user.id) : { data: [] };
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city]));
  const appointmentMap = new Map((appointments ?? []).map((appointment: any) => [appointment.id, appointment]));
  const eventHref = (eventId: string) => `/events/${eventId}?tripId=${encodeURIComponent(trip.id)}`;

  return (
    <main className="min-h-screen bg-black text-white">
      <TravelerNav />
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-12">
        <Link href="/account/trips" className="text-sm font-semibold text-zinc-400 hover:text-white">← My Trips</Link>
        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Journey</p><h1 className="mt-2 text-4xl font-black">{trip.title}</h1></div>
            <span className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300">{trip.status || "draft"}</span>
          </div>
          <p className="mt-4 text-zinc-400">{trip.start_on ? new Date(trip.start_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Dates not set"}{trip.end_on ? ` – ${new Date(trip.end_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}</p>
          <TripPlanTools tripId={trip.id} />
          <TripReorder tripId={trip.id} items={(items ?? []).map((item) => ({ id: item.id, title: item.title }))} />
          <div className="mt-10 space-y-4">
            {!items?.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center"><h2 className="text-xl font-bold">Nothing planned yet</h2><p className="mt-2 text-zinc-400">Browse SafariPlug experiences and add the ones you want to this journey.</p><Link href={`/events?tripId=${encodeURIComponent(trip.id)}`} className="mt-5 inline-flex rounded-full bg-amber-500 px-5 py-3 font-bold text-black">Explore experiences</Link></div>
            ) : items.map((item, index) => {
              const city = item.city_id ? cityMap.get(item.city_id) : null;
              const appointment = item.appointment_id ? appointmentMap.get(item.appointment_id) : null;
              const isService = item.item_kind === "personal_service" || Boolean(item.appointment_id);
              const displayTitle = appointment?.service_offerings?.name || item.title || "Experience";
              return <article key={item.id} className="flex gap-4 rounded-2xl border border-zinc-800 bg-black/50 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-black">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{isService ? "Booked service" : "Experience"}</span>{appointment?.status && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">{appointment.status.replaceAll("_", " ")}</span>}{appointment?.payment_status && <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Payment: {appointment.payment_status.replaceAll("_", " ")}</span>}</div><h2 className="mt-2 text-lg font-bold">{displayTitle}</h2>{appointment?.service_profiles?.businesses?.name && <p className="mt-1 text-sm text-zinc-400">{appointment.service_profiles.businesses.name}{appointment.service_staff?.display_name ? ` · ${appointment.service_staff.display_name}` : ""}</p>}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">{item.start_at && <span>📅 {new Date(item.start_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}{city && <span>📍 {city.name}{city.country ? `, ${city.country}` : ""}</span>}</div>{item.notes && <p className="mt-3 text-sm text-zinc-500">{item.notes}</p>}<div className="mt-4 flex flex-wrap items-center gap-4">{item.event_id && <Link href={eventHref(item.event_id)} className="text-sm font-semibold text-amber-400 hover:text-amber-300">View experience →</Link>}{isService && <Link href="/account/appointments" className="text-sm font-semibold text-amber-400 hover:text-amber-300">View booking →</Link>}<TripItemActions tripId={trip.id} itemId={item.id} /></div></div></article>;
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
