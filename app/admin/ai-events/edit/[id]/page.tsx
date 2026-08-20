import { supabaseAdmin } from "@/lib/supabase-admin";
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
  const resolvedParams = await params;
  const id = resolvedParams.id;

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

          <div className="mt-6 rounded-2xl bg-slate-100 p-5 font-mono text-sm">
            <p>
              <strong>ID:</strong> {id}
            </p>

            <p className="mt-2">
              <strong>Error:</strong>{" "}
              {error ? JSON.stringify(error) : "none"}
            </p>
          </div>
        </div>
      </main>
    );
  }

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
          Edit AI Discovery
        </h1>

        <p className="mt-3 text-slate-500">
          Review and improve AI generated event details before publishing.
        </p>

        <form
          action={updateAIEvent.bind(null, event.id)}
          className="mt-10 rounded-3xl bg-white p-8 shadow"
        >
          <div className="grid gap-6">

            <input
              type="hidden"
              name="id"
              value={event.id}
            />

            <div>
              <label className="font-black">
                Title
              </label>

              <input
                name="title"
                defaultValue={event.title ?? ""}
                className="mt-2 w-full rounded-xl border p-3"
                required
              />
            </div>

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
                  Category
                </label>

                <input
                  name="category"
                  defaultValue={event.category ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                  required
                />
              </div>

              <div>
                <label className="font-black">
                  City
                </label>

                <input
                  name="city"
                  defaultValue={event.city ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                  required
                />
              </div>

            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="font-black">
                  Venue
                </label>

                <input
                  name="venue_name"
                  defaultValue={event.venue_name ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                />
              </div>

              <div>
                <label className="font-black">
                  Venue Address
                </label>

                <input
                  name="venue_address"
                  defaultValue={event.venue_address ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                />
              </div>

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

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="font-black">
                  Price
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  defaultValue={event.price ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                  placeholder="Leave blank if free / TBA"
                />
              </div>

              <div>
                <label className="font-black">
                  Currency
                </label>

                <input
                  name="currency"
                  defaultValue={event.currency ?? ""}
                  className="mt-2 w-full rounded-xl border p-3"
                  placeholder="KES"
                />
              </div>

            </div>

            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-8 py-4 font-black text-white"
            >
              Save Changes
            </button>

          </div>
        </form>

        <div className="mt-8 rounded-3xl bg-slate-950 p-8 text-white">

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

          </div>

        </div>

        <div className="mt-8 flex gap-4">

          <form action={publishAIEvent.bind(null, event.id)}>
            <button
              type="submit"
              className="rounded-xl bg-green-600 px-8 py-4 font-black text-white"
            >
              Publish Event
            </button>
          </form>

          <form action={rejectAIEvent.bind(null, event.id)}>
            <button
              type="submit"
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