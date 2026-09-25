import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type DriverRequest = {
  id: string;
  traveler_id: string;
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

const STATUS_COPY: Record<string,string> = {
  requested: "Awaiting your response",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled by traveler",
  completed: "Completed",
};

export default async function DriverRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect(`/driver/login?next=${encodeURIComponent("/driver/requests")}`);

  const { data: driver } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,service_status,verification_state,service_city,service_country")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return <main className="min-h-screen bg-[#070708] px-6 py-12 text-white"><div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8"><h1 className="text-2xl font-black">No driver profile found</h1><p className="mt-3 text-zinc-500">This account is not linked to a SafariPlug driver application.</p><Link href="/driver/signup" className="mt-6 inline-block text-[#c9a86a]">Apply to drive →</Link></div></main>;
  }

  const { data: rows, error } = await supabaseAdmin
    .from("driver_transfer_requests")
    .select("id,traveler_id,trip_id,pickup_label,destination_label,requested_at,passenger_count,notes,quoted_amount,currency,status,created_at")
    .eq("driver_id", driver.id)
    .order("requested_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  const requests = (rows || []) as DriverRequest[];

  async function respond(formData: FormData) {
    "use server";
    const client = await createSupabaseServerClient();
    const { data: { user: current } } = await client.auth.getUser();
    if (!current || current.is_anonymous) redirect(`/driver/login?next=${encodeURIComponent("/driver/requests")}`);

    const requestId = String(formData.get("request_id") || "");
    const decision = String(formData.get("decision") || "");
    if (!requestId || !["accepted","declined"].includes(decision)) throw new Error("Choose a valid driver request action.");

    const { error: responseError } = await client.rpc("respond_to_driver_transfer_request", {
      p_request_id: requestId,
      p_decision: decision,
    });

    if (responseError) {
      const message = responseError.message;
      const friendly = message.includes("request_already_resolved") ? "This request has already been resolved."
        : message.includes("driver_not_eligible") ? "Your driver account is not currently eligible to accept requests."
        : message.includes("driver_unavailable") ? "Your availability marks this time as unavailable."
        : message.includes("request_not_found") ? "This request could not be found."
        : message;
      redirect(`/driver/requests?error=${encodeURIComponent(friendly)}`);
    }

    revalidatePath("/driver/requests");
    revalidatePath("/account/drivers");
    revalidatePath("/account");
    redirect(`/driver/requests?updated=${decision}`);
  }

  const pending = requests.filter(r => r.status === "requested");
  const history = requests.filter(r => r.status !== "requested");

  return <main className="min-h-screen bg-[#070708] text-white">
    <header className="border-b border-zinc-800/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <div><Link href="/" className="text-2xl font-black">Safari<span className="text-[#c9a86a]">Plug</span></Link><p className="mt-1 font-mono text-[10px] uppercase tracking-[.22em] text-zinc-600">Driver portal</p></div>
        <div className="flex gap-2"><Link href="/driver/application" className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300">Application</Link><Link href="/drivers" className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300">Public drivers</Link></div>
      </div>
    </header>
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[11px] uppercase tracking-[.25em] text-[#c9a86a]">Assignments</p><h1 className="mt-2 text-4xl font-black">Driver requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Accept only requests you can safely perform. A traveler request is not a paid or completed ride until later booking/payment steps record that state.</p></div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"><span className="text-zinc-500">Driver</span><p className="mt-1 font-semibold">{driver.display_name}</p><p className="text-xs text-zinc-600">{[driver.service_city,driver.service_country].filter(Boolean).join(", ")}</p></div>
      </div>

      {params.updated && <div className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">Request {params.updated === "accepted" ? "accepted" : "declined"}.</div>}
      {params.error && <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{params.error}</div>}

      <section className="mt-10">
        <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-zinc-600">Needs action</p><h2 className="mt-1 text-2xl font-bold">Pending requests</h2></div><span className="rounded-full bg-[#c9a86a]/10 px-3 py-1 text-sm font-bold text-[#c9a86a]">{pending.length}</span></div>
        <div className="mt-5 space-y-4">
          {pending.map(request => <RequestCard key={request.id} request={request} respond={respond} />)}
          {!pending.length && <div className="rounded-3xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-600">No pending driver requests.</div>}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-zinc-600">History</p><h2 className="mt-1 text-2xl font-bold">Resolved requests</h2></div><span className="text-sm text-zinc-600">{history.length}</span></div>
        <div className="mt-5 space-y-3">
          {history.map(request => <article key={request.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-zinc-600">{STATUS_COPY[request.status] || request.status}</p><h3 className="mt-2 font-semibold">{request.pickup_label} → {request.destination_label}</h3><p className="mt-2 text-sm text-zinc-500">{formatDate(request.requested_at)} · {request.passenger_count} passenger{request.passenger_count === 1 ? "" : "s"}</p></div>{request.quoted_amount != null && <p className="text-sm font-semibold text-zinc-300">{request.currency} {Number(request.quoted_amount).toLocaleString()}</p>}</div></article>)}
          {!history.length && <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-600">No resolved requests yet.</div>}
        </div>
      </section>
    </section>
  </main>;
}

function RequestCard({ request, respond }: { request: DriverRequest; respond: (formData: FormData) => Promise<void> }) {
  return <article className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row">
      <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#c9a86a]">Awaiting your response</p><h3 className="mt-2 text-xl font-bold">{request.pickup_label} → {request.destination_label}</h3><p className="mt-2 text-sm text-zinc-400">{formatDate(request.requested_at)} · {request.passenger_count} passenger{request.passenger_count === 1 ? "" : "s"}</p>{request.notes && <p className="mt-3 rounded-xl bg-black/40 p-3 text-xs leading-5 text-zinc-500">{request.notes}</p>}</div>
      <div className="shrink-0 sm:text-right">{request.quoted_amount != null ? <><p className="text-xs text-zinc-600">Recorded quote</p><p className="mt-1 text-lg font-bold">{request.currency} {Number(request.quoted_amount).toLocaleString()}</p></> : <p className="text-xs text-zinc-600">Custom quote requested</p>}</div>
    </div>
    <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
      <form action={respond}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="accepted"/><button className="rounded-xl bg-[#c9a86a] px-5 py-3 text-sm font-black text-black">Accept request</button></form>
      <form action={respond}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="declined"/><button className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300">Decline</button></form>
    </div>
  </article>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
