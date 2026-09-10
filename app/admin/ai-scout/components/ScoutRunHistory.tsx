"use client";

type ScoutRun = {
  id: string;
  location: string;
  category: string;
  status: string;
  events_found: number;
  sources_checked: number;
  sent_for_review: number;
  created_at: string;
};

export default function ScoutRunHistory({
  runs,
}: {
  runs: ScoutRun[];
}) {
  return (
    <section className="mt-10 rounded-3xl bg-white p-8 shadow-sm">

      <h2 className="text-3xl font-black">
        Scout Run History
      </h2>

      <p className="mt-2 text-gray-600">
        Previous AI Scout discovery runs.
      </p>

      <div className="mt-6 space-y-4">

        {runs.length === 0 && (
          <p className="text-gray-500">
            No scout runs yet.
          </p>
        )}

        {runs.map((run) => (
          <div
            key={run.id}
            className="rounded-2xl bg-[#f5f1e8] p-5"
          >

            <div className="flex flex-wrap justify-between gap-3">

              <div>
                <p className="font-black">
                  {run.location}
                </p>

                <p className="text-sm text-gray-600">
                  {run.category}
                </p>
              </div>

              <span className="rounded-full bg-green-100 px-4 py-2 text-xs font-black">
                {run.status}
              </span>

            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">

              <p>
                Events found:
                <strong> {run.events_found}</strong>
              </p>

              <p>
                Sources:
                <strong> {run.sources_checked}</strong>
              </p>

              <p>
                Review:
                <strong> {run.sent_for_review}</strong>
              </p>

            </div>

            <p className="mt-4 text-xs text-gray-500">
              {new Date(run.created_at).toLocaleString()}
            </p>

          </div>
        ))}

      </div>

    </section>
  );
}
