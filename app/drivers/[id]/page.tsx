import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTravelerVerificationState } from "@/lib/services/traveler-verification";
import { driverVerificationCurrent } from "@/lib/services/driver-verification";

export const dynamic = "force-dynamic";

export default async function DriverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { id } = await params;
  const { tripId: rawTripId } = await searchParams;
  const tripId = rawTripId?.trim() || null;
  const returnPath = `/drivers/${id}${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ""}`;

  const { data: driver } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,personal_photo_url,identity_liveness_verified_at,service_city,service_country,verification_state,service_status,driving_license_compliance_status,driver_transfer_rates(id,rate_type,origin_label,destination_label,airport_code,amount,currency,status),vehicles(id,make_model,category,passenger_capacity,status,registration_compliance_status,insurance_compliance_status)")
    .eq("id", id)
    .eq("service_status", "active")
    .eq("verification_state", "verified")
    .in("driving_license_compliance_status", ["valid", "expiring_soon"])
    .maybeSingle();

  if (!driver || !driver.personal_photo_url || !(await driverVerificationCurrent(driver))) notFound();

  const vehicles = (driver.vehicles ?? []).filter((vehicle: any) =>
    vehicle.status === "active" &&
    ["valid", "expiring_soon"].includes(vehicle.registration_compliance_status) &&
    ["valid", "expiring_soon"].includes(vehicle.insurance_compliance_status)
  );
  if (!vehicles.length) notFound();

  const rates = (driver.driver_transfer_rates ?? []).filter((rate: any) => rate.status === "active");

  async function requestDriver(formData: FormData) {
    "use server";
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

    const trust = await getTravelerVerificationState(user.id);
    if (!trust.verified) redirect(`/account/verification?next=${encodeURIComponent(returnPath)}`);

    const requestedAt = String(formData.get("requested_at") || "");
    const when = new Date(requestedAt);
    if (!requestedAt || Number.isNaN(when.getTime()) || when <= new Date()) throw new Error("Choose a future pickup time.");

    const pickup = String(formData.get("pickup") || "").trim();
    const destination = String(formData.get("destination") || "").trim();
    if (!pickup || !destination) throw new Error("Pickup and destination are required.");

    const passengers = Math.max(1, Math.min(50, Number(formData.get("passengers") || 1)));
    const rateId = String(formData.get("rate_id") || "") || null;
    const requestedTripId = String(formData.get("trip_id") || "").trim() || null;

    let linkedTripId: string | null = null;
    if (requestedTripId) {
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("id")
        .eq("id", requestedTripId)
        .eq("traveler_id", user.id)
        .maybeSingle();
      if (tripError) throw new Error(tripError.message);
      if (!trip) throw new Error("This SafariPlug trip could not be found.");
      linkedTripId = trip.id;
    }

    let quotedAmount: number | null = null;
    let currency = "KES";
    if (rateId) {
      const { data: rate } = await supabaseAdmin
        .from("driver_transfer_rates")
        .select("id,amount,currency,status,driver_id")
        .eq("id", rateId)
        .eq("driver_id", id)
        .eq("status", "active")
        .maybeSingle();
      if (!rate) throw new Error("That transfer rate is no longer available.");
      quotedAmount = Number(rate.amount);
      currency = rate.currency;
    }

    const { data: request, error } = await supabase
      .from("driver_transfer_requests")
      .insert({
        traveler_id: user.id,
        driver_id: id,
        transfer_rate_id: rateId,
        trip_id: linkedTripId,
        pickup_label: pickup,
        destination_label: destination,
        requested_at: when.toISOString(),
        passenger_count: passengers,
        notes: String(formData.get("notes") || "").trim() || null,
        quoted_amount: quotedAmount,
        currency,
      })
      .select("id")
      .single();

    if (error || !request) throw new Error(error?.message || "Unable to create driver request.");

    revalidatePath("/account");
    revalidatePath("/account/drivers");
    revalidatePath("/account/trips");
    if (linkedTripId) revalidatePath(`/account/trips/${linkedTripId}`);
    redirect(`/account/drivers?created=${encodeURIComponent(request.id)}#request-${request.id}`);
  }

  const allDriversHref = tripId ? `/drivers?tripId=${encodeURIComponent(tripId)}` : "/drivers";

  return <main className="min-h-screen bg-[#f7f7f4]">
    <section className="mx-auto max-w-4xl px-6 py-12">
      <Link href={allDriversHref} className="text-sm font-semibold">← All drivers</Link>
      <div className="mt-8 rounded-[2rem] bg-black p-8 text-white">
        <div className="flex items-center gap-5">
          <img src={driver.personal_photo_url} alt={driver.display_name} className="h-24 w-24 rounded-3xl object-cover"/>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Verified SafariPlug driver</p>
            <h1 className="mt-3 text-4xl font-semibold">{driver.display_name}</h1>
          </div>
        </div>
        <p className="mt-2 text-white/50">{[driver.service_city, driver.service_country].filter(Boolean).join(", ")}</p>
        <p className="mt-5 text-sm leading-6 text-white/55">Request this specific driver for a real transfer. Submission does not guarantee availability or create a confirmed ride.</p>
      </div>

      {tripId && <div className="mt-5 rounded-2xl border border-black/8 bg-white p-4 text-sm text-black/55">This request will be linked to your selected SafariPlug trip after SafariPlug verifies that the trip belongs to your account.</div>}

      {rates.length > 0 && <section className="mt-7 rounded-[1.75rem] bg-white p-6">
        <h2 className="text-xl font-semibold">Published rates</h2>
        <div className="mt-4 space-y-3">{rates.map((rate: any) =>
          <div key={rate.id} className="flex justify-between rounded-xl bg-black/[.035] p-4 text-sm">
            <span>{rate.origin_label || rate.airport_code || rate.rate_type.replaceAll("_", " ")}{rate.destination_label ? ` → ${rate.destination_label}` : ""}</span>
            <strong>{rate.currency} {Number(rate.amount).toLocaleString()}</strong>
          </div>
        )}</div>
      </section>}

      <form action={requestDriver} className="mt-7 rounded-[1.75rem] bg-white p-6">
        <input type="hidden" name="trip_id" value={tripId || ""}/>
        <h2 className="text-xl font-semibold">Request {driver.display_name}</h2>
        <p className="mt-2 text-sm leading-6 text-black/50">For both traveler and driver safety, SafariPlug requires approved SafariPlug traveler verification before a specific-driver request can be submitted.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <input required name="pickup" placeholder="Pickup location" className="rounded-xl border border-black/10 px-4 py-3 text-sm"/>
          <input required name="destination" placeholder="Destination" className="rounded-xl border border-black/10 px-4 py-3 text-sm"/>
          <input required name="requested_at" type="datetime-local" className="rounded-xl border border-black/10 px-4 py-3 text-sm"/>
          <input name="passengers" type="number" min="1" max="50" defaultValue="1" className="rounded-xl border border-black/10 px-4 py-3 text-sm"/>
          {rates.length > 0 && <select name="rate_id" className="rounded-xl border border-black/10 px-4 py-3 text-sm sm:col-span-2">
            <option value="">Request custom quote</option>
            {rates.map((rate: any) => <option key={rate.id} value={rate.id}>{rate.origin_label || rate.airport_code || rate.rate_type} {rate.destination_label ? `→ ${rate.destination_label}` : ""} — {rate.currency} {Number(rate.amount).toLocaleString()}</option>)}
          </select>}
          <textarea name="notes" placeholder="Flight, luggage, child seat or trip details (optional)" className="min-h-24 rounded-xl border border-black/10 px-4 py-3 text-sm sm:col-span-2"/>
        </div>
        <button className="mt-5 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white">Send driver request</button>
        <p className="mt-3 text-xs leading-5 text-black/45">Any displayed rate is captured as the request quote. The ride is not confirmed or paid until the required acceptance and booking steps are completed.</p>
      </form>
    </section>
  </main>;
}
