import { supabaseAdmin } from "@/lib/supabase-admin";
import { fallbackImage } from "@/lib/constants/event-images";
import {
  updateAIEvent,
  publishAIEvent,
  rejectAIEvent,
} from "./actions";

export default async function EditAIEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: event, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !event) {
    return (
      <main className="min-h-screen bg-[#fffaf5] p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow">
          <h1 className="text-3xl font-black">
            Event not found
          </h1>

          <p className="mt-4 text-slate-600">
            {error ? JSON.stringify(error) : "No event found."}
          </p>
        </div>
      </main>
    );
  }

  const reviewChecks = [
    {
      label: event.image_url
        ? "Official image found"
        : "Fallback image only",
      passed: Boolean(event.image_url),
    },
    {
      label: "Description found",
      passed: Boolean(event.description),
    },
    {
      label: "Date found",
      passed: Boolean(event.start_at),
    },
    {
      label: "Venue found",
      passed: Boolean(event.venue_name),
    },
    {
      label: "Venue address found",
      passed: Boolean(event.venue_address),
    },
    {
      label: "Price found",
      passed:
        event.price !== null &&
        event.price !== undefined &&
        event.price !== "",
    },
    {
      label: "Organizer found",
      passed: Boolean(event.organizer_name),
    },
    {
      label: "End date found",
      passed: Boolean(event.end_at),
    },
    {
      label: "Source verified",
      passed: Boolean(event.source_url),
    },
  ];

  const readinessScore = Math.round(
    (reviewChecks.filter((check) => check.passed).length /
      reviewChecks.length) *
      100
  );
const missingChecks = reviewChecks.filter(
  (check) => !check.passed
);

  const formatDateTimeLocal = (value: string | null) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <main className="min-h-screen bg-[#fffaf5] p-8">
      <div className="mx-auto max-w-5xl">

        <h1 className="text-5xl font-black">
          AI Discovery Review
        </h1>

        <p className="mt-3 text-slate-500">
          Review, improve, and approve AI discovered events before publishing.
        </p>


        <form
  action={updateAIEvent.bind(null, event.id)}
  className="mt-10 rounded-3xl bg-white p-8 shadow"
>
<div className="grid gap-6">

            {[
              ["title", "Title", event.title],
              ["category", "Category", event.category],
              ["city", "City", event.city],
              ["venue_name", "Venue", event.venue_name],
              ["venue_address", "Venue Address", event.venue_address],
              ["currency", "Currency", event.currency],
            ].map(([name, label, value]) => (
              <div key={name}>
                <label className="font-black">
                  {label}
                </label>

                <input
                  name={name}
                  defaultValue={value ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                />
              </div>
            ))}


            <div>
              <label className="font-black">
                Description
              </label>

              <textarea
                name="description"
                defaultValue={event.description ?? ""}
                className="mt-2 h-32 w-full rounded-xl border p-3"
              />
            </div>


            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="font-black">
                  Start
                </label>

                <input
                  type="datetime-local"
                  name="start_at"
                  defaultValue={formatDateTimeLocal(event.start_at)}
                  className="mt-2 w-full rounded-xl border p-3"
                />
              </div>


              <div>
                <label className="font-black">
                  End
                </label>

                <input
                  type="datetime-local"
                  name="end_at"
                  defaultValue={formatDateTimeLocal(event.end_at)}
                  className="mt-2 w-full rounded-xl border p-3"
                />
              </div>

            </div>


            <div>
              <label className="font-black">
                Price
              </label>

              <input
                type="number"
                name="price"
                defaultValue={event.price ?? ""}
                className="mt-2 w-full rounded-xl border p-3"
              />
            </div>


            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-8 py-4 font-black text-white"
            >
              Save Changes
            </button>

          </div>

        </form>


        <section className="mt-8 rounded-3xl bg-slate-950 p-8 text-white">

          <h2 className="text-2xl font-black">
            AI Verification
          </h2>


          <div className="mt-4 space-y-2">

            <p>
              Confidence: {event.confidence_score}%
            </p>

            <p>
              Source: {event.source_name}
            </p>

            <p>
              Status: {event.status}
            </p>

            <p className="text-xl font-black">
              Readiness Score: {readinessScore}%
            </p>

          </div>


          <div className="mt-6 space-y-3">

            {reviewChecks.map((check) => (
              <div
                key={check.label}
                className="flex justify-between rounded-xl bg-white/10 p-4"
              >

                <span>
                  {check.label}
                </span>

                <span>
                  {check.passed
                    ? "âœ“ Ready"
                    : "âš  Review"}
                </span>

              </div>
            ))}

          </div>

        </section>


        <section className="mt-8 rounded-3xl bg-white p-8 shadow">

          <h2 className="text-2xl font-black">
            Source Evidence
          </h2>


          <p className="mt-4 font-bold">
            {event.source_name}
          </p>


          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-orange-600 font-black"
            >
              Open Source â†’
            </a>
          )}


          <div className="mt-6">

            <h3 className="font-black">
              Event Image
            </h3>


            <img
              src={
                event.image_url ||
                fallbackImage(event.category || "")
              }
              alt={event.title}
              className="mt-3 h-64 w-full rounded-2xl object-cover"
            />


            {!event.image_url && (
              <p className="mt-3 text-sm text-slate-500">
                No official image found. Category fallback displayed.
              </p>
            )}

          </div>

        </section>

{missingChecks.length > 0 && (
  <div className="mt-8 rounded-3xl bg-amber-50 p-6 text-amber-900">
    <h3 className="font-black">
      Review Items Before Publishing
    </h3>

    <ul className="mt-3 list-disc pl-5">
      {missingChecks.map((check) => (
        <li key={check.label}>
          {check.label}
        </li>
      ))}
    </ul>
  </div>
)}
        <div className="mt-8 flex gap-4">

          <form action={publishAIEvent.bind(null, event.id)}>
  <button
    disabled={readinessScore < 80}
    className={
      readinessScore < 80
        ? "rounded-xl bg-gray-400 px-8 py-4 font-black text-white cursor-not-allowed"
        : "rounded-xl bg-green-600 px-8 py-4 font-black text-white"
    }
  >
    {readinessScore < 80
      ? "Needs Review"
      : "Publish Event"}
  </button>
</form>


          <form action={rejectAIEvent.bind(null, event.id)}>
            <button
              className="rounded-xl bg-red-600 px-8 py-4 font-black text-white"
            >
              Reject
            </button>
          </form>

        </div>


      </div>
    </main>
  );
}