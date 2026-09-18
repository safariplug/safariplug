import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTravelerVerificationState } from "@/lib/services/traveler-verification";

export const dynamic = "force-dynamic";

type Availability = {
  available_on: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
};

type Trip = {
  id: string;
  title: string | null;
  start_on: string | null;
  end_on: string | null;
};

export default async function LocalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: local } = await supabaseAdmin
    .from("local_profiles")
    .select("id,display_name,bio,personal_photo_url,city,country,languages,interests,specialties,hourly_rate,currency")
    .eq("id", id)
    .eq("service_status", "active")
    .eq("verification_state", "verified")
    .maybeSingle();

  if (!local) notFound();

  // Capture the fields used by the server action after the null guard. Server
  // actions are compiled separately, so relying on closure narrowing of the
  // nullable query result causes TypeScript to widen `local` back to nullable.
  const localRequestContext = {
    displayName: local.display_name,
    city: local.city,
    currency: local.currency,
  };

  const { data: availability } = await supabaseAdmin
    .from("local_availability")
    .select("available_on,start_time,end_time,timezone")
    .eq("local_id", id)
    .eq("status", "available")
    .gte("available_on", new Date().toISOString().slice(0, 10))
    .order("available_on")
    .limit(20);

  async function requestLocal(formData: FormData) {
    "use server";
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) redirect(`/account/login?next=/locals/${id}`);
    const trust = await getTravelerVerificationState(user.id);
    if (!trust.verified) redirect(`/account/verification?next=${encodeURIComponent(`/locals/${id}`)}`);

    const start = String(formData.get("requested_start_at") || "");
    const end = String(formData.get("requested_end_at") || "");
    const trip = String(formData.get("trip_id") || "") || null;
    const { data: req, error } = await db
      .from("local_requests")
      .insert({
        traveler_id: user.id,
        local_id: id,
        trip_id: trip,
        requested_start_at: new Date(start).toISOString(),
        requested_end_at: end ? new Date(end).toISOString() : null,
        activity: String(formData.get("activity") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        city: localRequestContext.city,
        currency: localRequestContext.currency,
      })
      .select("id")
      .single();

    if (error || !req) redirect(`/locals/${id}?error=request`);

    if (trip) {
      const { data: last } = await db
        .from("trip_items")
        .select("position")
        .eq("trip_id", trip)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      await db.from("trip_items").insert({
        trip_id: trip,
        local_request_id: req.id,
        item_kind: "local",
        title: `Local: ${localRequestContext.displayName}`,
        start_at: new Date(start).toISOString(),
        end_at: end ? new Date(end).toISOString() : null,
        position: (last?.position ?? -1) + 1,
      });
    }
    redirect("/account/trips");
  }

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  let trips: Trip[] = [];
  if (user) {
    const result = await db
      .from("trips")
      .select("id,title,start_on,end_on")
      .eq("traveler_id", user.id)
      .order("created_at", { ascending: false });
    trips = (result.data ?? []) as Trip[];
  }

  const publishedAvailability = (availability ?? []) as Availability[];

  return <main className="min-h-screen bg-[#f7f7f4] px-6 py-10"><div className="mx-auto max-w-5xl"><Link href="/locals" className="text-sm font-semibold">← All locals</Link><div className="mt-8 grid gap-8 lg:grid-cols-[.85fr_1.15fr]"><section>{local.personal_photo_url ? <img src={local.personal_photo_url} alt={local.display_name} className="aspect-[4/5] w-full rounded-[2rem] object-cover" /> : <div className="flex aspect-[4/5] items-center justify-center rounded-[2rem] bg-black text-7xl text-white">{local.display_name[0]}</div>}<div className="mt-5 flex items-center gap-3"><h1 className="text-3xl font-semibold">{local.display_name}</h1><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">✓ Verified</span></div><p className="mt-1 text-sm text-black/45">{[local.city, local.country].filter(Boolean).join(", ")}</p><p className="mt-5 leading-7 text-black/65">{local.bio}</p><p className="mt-5 text-sm"><b>Languages:</b> {(local.languages || []).join(" · ")}</p><p className="mt-2 text-sm"><b>Interests:</b> {(local.interests || []).join(" · ")}</p><p className="mt-5 text-xl font-semibold">{local.hourly_rate != null ? `${local.currency} ${Number(local.hourly_rate).toLocaleString()}/hr` : "Rate on request"}</p></section><section className="rounded-[2rem] bg-white p-6 sm:p-8"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-black/40">Specific-local request</p><h2 className="mt-2 text-2xl font-semibold">Request {local.display_name}</h2><p className="mt-2 text-sm leading-6 text-black/50">This sends a real request; it does not claim the Local has accepted or that the meeting is booked. SafariPlug requires approved traveler identity + live face verification before a specific-Local request is submitted.</p>{publishedAvailability.length > 0 && <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-black/40">Published availability</p><div className="mt-2 flex flex-wrap gap-2">{publishedAvailability.slice(0, 8).map((slot) => <span key={`${slot.available_on}-${slot.start_time}`} className="rounded-full bg-[#f2f0e9] px-3 py-2 text-xs">{slot.available_on}{slot.start_time ? ` · ${String(slot.start_time).slice(0, 5)}` : ""}</span>)}</div></div>}<form action={requestLocal} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Start<input name="requested_start_at" type="datetime-local" required className="rounded-xl border p-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">End<input name="requested_end_at" type="datetime-local" className="rounded-xl border p-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">What would you like to do?<input name="activity" placeholder="Food tour, nightlife, city orientation…" className="rounded-xl border p-3 font-normal" /></label>{user && <label className="grid gap-2 text-sm font-semibold">Add to My Trip<select name="trip_id" className="rounded-xl border p-3 font-normal"><option value="">No trip yet</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title || "Untitled trip"}</option>)}</select></label>}<label className="grid gap-2 text-sm font-semibold">Notes<textarea name="notes" rows={3} className="rounded-xl border p-3 font-normal" /></label><button className="rounded-full bg-black px-6 py-4 text-sm font-bold text-white">{user ? `Request ${local.display_name}` : "Sign in to request"}</button></form></section></div></div></main>;
}
