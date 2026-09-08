import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type TripItem = {
  id: string;
  item_kind: string | null;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  notes: string | null;
  position: number | null;
  city_id: string | null;
  event_id: string | null;
  appointment_id: string | null;
  offering_id: string | null;
  booking_id: string | null;
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/trips/${id}`)}`);

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id,title,start_on,end_on,status,destination_city_id")
    .eq("id", id)
    .eq("traveler_id", user.id)
    .maybeSingle();

  if (tripError || !trip) notFound();

  const { data: items } = await supabase
    .from("trip_items")
    .select("id,item_kind,title,start_at,end_at,notes,position,city_id,event_id,appointment_id,offering_id,booking_id")
    .eq("trip_id", id)
    .order("position", { ascending: true })
    .order("start_at", { ascending: true, nullsFirst: false });

  const itinerary = (items ?? []) as TripItem[];

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#111] text-white">
        <div className="mx-auto max-w-5xl px-6 pb-14 pt-10 sm:px-10">
          <Link href="/trips" className="text-xs font-semibold uppercase tracking-[.18em] text-white/45 hover:text-white">← My trips</Link>
          <div className="mt-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-white/40">SafariPlug itinerary</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{trip.title || "Untitled trip"}</h1>
              <p className="mt-4 text-sm text-white/55">
                {trip.start_on || "Date not set"}{trip.end_on ? ` — ${trip.end_on}` : ""}
              </p>
            </div>
            <span className="w-fit rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/60">
              {trip.status || "draft"}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Your journey</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{itinerary.length ? `${itinerary.length} itinerary item${itinerary.length === 1 ? "" : "s"}` : "Nothing added yet"}</h2>
          </div>
          <div className="flex gap-2">
            <Link href="/events" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold">Find experiences</Link>
            <Link href="/concierge" className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">Ask Concierge</Link>
          </div>
        </div>

        {itinerary.length ? (
          <div className="mt-6 space-y-3">
            {itinerary.map((item, index) => (
              <article key={item.id} className="rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">{formatKind(item.item_kind)}</p>
                      {item.booking_id && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-emerald-700">Booking</span>}
                      {item.appointment_id && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-amber-700">Appointment</span>}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{item.title || fallbackTitle(item.item_kind)}</h3>
                    {item.start_at && <p className="mt-2 text-sm text-black/50">{formatDate(item.start_at)}{item.end_at ? ` — ${formatDate(item.end_at)}` : ""}</p>}
                    {item.notes && <p className="mt-2 text-sm leading-6 text-black/55">{item.notes}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-black/15 bg-white px-6 py-16 text-center">
            <p className="text-lg font-semibold">Build this trip as you go.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">Add experiences, service appointments and bookings to keep the whole journey together.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/events" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Explore events</Link>
              <Link href="/services" className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold">Browse services</Link>
              <Link href="/hotels" className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold">Find a hotel</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function formatKind(kind: string | null) {
  return (kind || "plan").replace(/_/g, " ");
}

function fallbackTitle(kind: string | null) {
  switch (kind) {
    case "hotel": return "Hotel stay";
    case "service": return "Service appointment";
    case "restaurant": return "Restaurant";
    case "food_order": return "Food order";
    case "event": return "Experience or event";
    default: return "Trip item";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
