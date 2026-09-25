import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import TravelerNav from "@/components/TravelerNav";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type DriverRequest = {
  id: string;
  driver_id: string;
  trip_id: string | null;
  pickup_label: string;
  destination_label: string;
  requested_at: string;
  passenger_count: number;
  notes: string | null;
  quoted_amount: number | null;
  currency: string;
  status: string;
  created_at: string;
};

const STATUS_COPY: Record<string, { label: string; detail: string }> = {
  requested: { label: "Awaiting driver", detail: "The driver has not accepted this request yet." },
  accepted: { label: "Driver accepted", detail: "The driver accepted the request. This request itself does not record a payment or completed ride." },
  declined: { label: "Declined", detail: "The driver could not take this request." },
  cancelled: { label: "Cancelled", detail: "You cancelled this request before driver acceptance." },
  completed: { label: "Completed", detail: "SafariPlug recorded this driver transfer as completed." },
};

export default async function DriverRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; cancelled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect(`/login?next=${encodeURIComponent("/account/drivers")}`);

  const { data: rows, error } = await supabaseAdmin
    .from("driver_transfer_requests")
    .select("id,driver_id,trip_id,pickup_label,destination_label,requested_at,passenger_count,notes,quoted_amount,currency,status,created_at")
    .eq("traveler_id", user.id)
    .order("requested_at", { ascending: false });

  if (error) throw new Error(error.message);

  const requests = (rows || []) as DriverRequest[];
  const driverIds = [...new Set(requests.map((row) => row.driver_id))];
  const tripIds = [...new Set(requests.map((row) => row.trip_id).filter(Boolean))] as string[];

  const [{ data: drivers }, { data: trips }] = await Promise.all([
    driverIds.length
      ? supabaseAdmin.from("driver_profiles").select("id,display_name,personal_photo_url,service_city,service_country").in("id", driverIds)
      : Promise.resolve({ data: [] as any[] }),
    tripIds.length
      ? supabaseAdmin.from("trips").select("id,title").eq("traveler_id", user.id).in("id", tripIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const driverById = new Map((drivers || []).map((driver: any) => [driver.id, driver]));
  const tripById = new Map((trips || []).map((trip: any) => [trip.id, trip]));

  async function cancelRequest(formData: FormData) {
    "use server";
    const client = await createSupabaseServerClient();
    const { data: { user: current } } = await client.auth.getUser();
    if (!current || current.is_anonymous) redirect(`/login?next=${encodeURIComponent("/account/drivers")}`);
    const requestId = String(formData.get("request_id") || "");
    if (!requestId) throw new Error("Driver request is required.");
    const { error: cancelError } = await client.rpc("cancel_driver_transfer_request", { p_request_id: requestId });
    if (cancelError) throw new Error(cancelError.message === "request_not_cancellable" ? "Only a pending driver request can be cancelled." : cancelError.message);
    revalidatePath("/account/drivers");
    revalidatePath("/account");
    revalidatePath("/account/trips");
    redirect("/account/drivers?cancelled=1");
  }

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <TravelerNav />
    <section className="bg-[#111] text-white">
      <div className="mx-auto max-w-6xl px-6 pb-14 pt-12 sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[.24em] text-[#c9a86a]">My SafariPlug</p>
        <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Driver requests.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Track every specific-driver request from submission through the driver response. SafariPlug does not show a ride as confirmed until the recorded request state supports it.</p>
          </div>
          <Link href="/drivers" className="w-fit rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Find a driver</Link>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      {params.created && <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Driver request sent. The ride is still pending until the driver responds.</div>}
      {params.cancelled && <div className="mb-6 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">Driver request cancelled.</div>}

      <div className="grid gap-4">
        {requests.map((request) => {
          const driver = driverById.get(request.driver_id) as any;
          const trip = request.trip_id ? tripById.get(request.trip_id) as any : null;
          const status = STATUS_COPY[request.status] || { label: request.status.replaceAll("_", " "), detail: "SafariPlug is tracking this request state." };
          return <article key={request.id} id={`request-${request.id}`} className="rounded-[1.6rem] border border-black/8 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  {driver?.personal_photo_url && <img src={driver.personal_photo_url} alt={driver.display_name || "SafariPlug driver"} className="h-12 w-12 rounded-full object-cover" />}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/35">{status.label}</p>
                    <h2 className="mt-1 text-xl font-semibold">{driver?.display_name || "SafariPlug driver"}</h2>
                    <p className="mt-1 text-xs text-black/45">{[driver?.service_city, driver?.service_country].filter(Boolean).join(", ") || "Service area not recorded"}</p>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{request.pickup_label} → {request.destination_label}</h3>
                <p className="mt-2 text-sm text-black/50">{formatDate(request.requested_at)} · {request.passenger_count} passenger{request.passenger_count === 1 ? "" : "s"}</p>
                <p className="mt-3 text-xs leading-5 text-black/45">{status.detail}</p>
                {request.notes && <p className="mt-3 max-w-2xl rounded-xl bg-black/[.035] p-3 text-xs leading-5 text-black/55">{request.notes}</p>}
              </div>
              <div className="shrink-0 sm:text-right">
                {request.quoted_amount != null ? <><p className="text-xs text-black/40">Recorded quote</p><p className="mt-1 text-lg font-semibold">{request.currency} {Number(request.quoted_amount).toLocaleString()}</p></> : <p className="text-xs text-black/40">Custom quote requested</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/8 pt-4">
              {trip && <Link href={`/account/trips/${trip.id}`} className="text-sm font-semibold">Trip: {trip.title || "Open journey"} →</Link>}
              <Link href={`/drivers/${request.driver_id}${request.trip_id ? `?tripId=${encodeURIComponent(request.trip_id)}` : ""}`} className="text-sm font-semibold text-black/55">View driver</Link>
              {request.status === "requested" && <form action={cancelRequest} className="ml-auto"><input type="hidden" name="request_id" value={request.id}/><button className="text-sm font-semibold text-red-700">Cancel request</button></form>}
            </div>
          </article>;
        })}
        {!requests.length && <div className="rounded-[1.6rem] border border-dashed border-black/15 bg-white px-6 py-14 text-center"><h2 className="text-xl font-semibold">No driver requests yet.</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/50">Choose an eligible verified driver, submit the pickup details, and SafariPlug will keep the real request state here.</p><Link href="/drivers" className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Find a driver →</Link></div>}
      </div>
    </section>
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
