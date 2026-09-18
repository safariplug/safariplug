"use client";

import { FormEvent, useState } from "react";

type ActivityCard = {
  code: string;
  name: string;
  description?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
  amountsFrom?: Array<{ paxType?: string | null; ageFrom?: number | null; ageTo?: number | null; amount?: number | null }>;
};

type ActivitySelection = {
  selectionToken: string;
  supplierAmount: number;
  supplierCurrency: string;
  activityCode: string;
  activityName: string;
  modalityCode: string;
  modalityName: string;
  from: string;
  to: string;
  rateClass?: string | null;
  freeCancellation?: boolean | null;
  cancellationPolicies?: Array<{ amount?: number | null; dateFrom?: string | null; dateTo?: string | null }>;
  session?: { code?: string; name?: string | null } | null;
  language?: { code?: string; name?: string | null } | null;
  questions?: Array<{ code: string; text: string; required: boolean }>;
  comments?: string[];
};

export default function ActivitySearchClient() {
  const [search, setSearch] = useState({ destinationCode: "", from: "", to: "", ages: "35,32", text: "" });
  const [activities, setActivities] = useState<ActivityCard[]>([]);
  const [selections, setSelections] = useState<ActivitySelection[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityCard | null>(null);
  const [busy, setBusy] = useState<"search" | "details" | null>(null);
  const [error, setError] = useState("");

  function ages() {
    return search.ages
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((age) => Number.isFinite(age) && age >= 0 && age <= 120);
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const passengerAges = ages();
    if (!passengerAges.length) {
      setError("Enter at least one passenger age.");
      return;
    }
    setBusy("search");
    setError("");
    setActivities([]);
    setSelections([]);
    setSelectedActivity(null);
    try {
      const response = await fetch("/api/v1/activities/hotelbeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "search",
          destinationCode: search.destinationCode.trim(),
          from: search.from,
          to: search.to,
          paxes: passengerAges.map((age) => ({ age })),
          text: search.text.trim() || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to search Hotelbeds Activities.");
      const rows = Array.isArray(body.results) ? body.results as ActivityCard[] : [];
      setActivities(rows);
      if (!rows.length) setError("No live activities were returned for this search.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search Hotelbeds Activities.");
    } finally {
      setBusy(null);
    }
  }

  async function loadDetails(activity: ActivityCard) {
    const passengerAges = ages();
    setSelectedActivity(activity);
    setSelections([]);
    setBusy("details");
    setError("");
    try {
      const response = await fetch("/api/v1/activities/hotelbeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "details",
          code: activity.code,
          from: search.from,
          to: search.to,
          paxes: passengerAges.map((age) => ({ age })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to load activity details.");
      const rows = Array.isArray(body.results) ? body.results as ActivitySelection[] : [];
      setSelections(rows);
      if (!rows.length) setError("No bookable rate was returned for this activity and date.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load activity details.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Live supplier search</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Find an activity</h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          Each search is an explicit Hotelbeds request. SafariPlug never searches or books in the background.
        </p>

        <form onSubmit={runSearch} className="mt-6 grid gap-3 sm:grid-cols-2">
          <input
            value={search.destinationCode}
            onChange={(e) => setSearch({ ...search, destinationCode: e.target.value })}
            required
            placeholder="Hotelbeds destination code"
            className="rounded-xl border border-black/10 px-4 py-3 sm:col-span-2"
          />
          <label className="text-xs text-black/45">From<input type="date" required value={search.from} onChange={(e) => setSearch({ ...search, from: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3" /></label>
          <label className="text-xs text-black/45">To<input type="date" required value={search.to} onChange={(e) => setSearch({ ...search, to: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3" /></label>
          <input value={search.ages} onChange={(e) => setSearch({ ...search, ages: e.target.value })} required placeholder="Passenger ages, e.g. 35,32,8" className="rounded-xl border border-black/10 px-4 py-3 sm:col-span-2" />
          <input value={search.text} onChange={(e) => setSearch({ ...search, text: e.target.value })} placeholder="Optional keyword, e.g. safari" className="rounded-xl border border-black/10 px-4 py-3 sm:col-span-2" />
          <button disabled={busy !== null} className="rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">
            {busy === "search" ? "Searching Hotelbeds…" : "Search live activities"}
          </button>
        </form>
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Results</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{selectedActivity ? selectedActivity.name : "Available activities"}</h2>

        {selectedActivity ? (
          <button type="button" onClick={() => { setSelectedActivity(null); setSelections([]); setError(""); }} className="mt-3 text-sm font-semibold text-[#9d793e]">← Back to search results</button>
        ) : null}

        {!selectedActivity ? (
          <div className="mt-5 grid gap-4">
            {activities.map((activity) => (
              <article key={activity.code} className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-sm">
                {activity.imageUrl ? <img src={activity.imageUrl} alt="" className="h-44 w-full object-cover" /> : null}
                <div className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">Hotelbeds activity</p>
                  <h3 className="mt-2 text-xl font-semibold">{activity.name}</h3>
                  {activity.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-black/55">{activity.description}</p> : null}
                  {activity.amountsFrom?.length ? (
                    <p className="mt-3 text-sm font-semibold">
                      From {activity.currency || ""} {Number(activity.amountsFrom[0]?.amount || 0).toLocaleString()}
                    </p>
                  ) : null}
                  <button type="button" disabled={busy !== null} onClick={() => void loadDetails(activity)} className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === "details" && selectedActivity?.code === activity.code ? "Checking live rates…" : "See live options →"}
                  </button>
                </div>
              </article>
            ))}
            {!activities.length ? (
              <div className="rounded-[1.75rem] border border-dashed border-black/15 bg-white p-8 text-sm leading-6 text-black/50">
                Search by destination and dates. SafariPlug displays only supplier inventory returned by Hotelbeds.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {selections.map((selection, index) => (
              <article key={selection.selectionToken} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-black/35">Option {index + 1}</p>
                    <h3 className="mt-2 text-xl font-semibold">{selection.modalityName}</h3>
                    <p className="mt-1 text-sm text-black/45">{selection.from} → {selection.to}</p>
                    {selection.session?.name ? <p className="mt-1 text-sm text-black/45">Session: {selection.session.name}</p> : null}
                    {selection.language?.name ? <p className="mt-1 text-sm text-black/45">Language: {selection.language.name}</p> : null}
                  </div>
                  <p className="text-xl font-semibold">{selection.supplierCurrency} {Number(selection.supplierAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {selection.rateClass ? <span className="rounded-full bg-black/[.04] px-3 py-1.5">{selection.rateClass}</span> : null}
                  {selection.freeCancellation !== null && selection.freeCancellation !== undefined ? <span className="rounded-full bg-black/[.04] px-3 py-1.5">{selection.freeCancellation ? "Free cancellation" : "Cancellation penalties may apply"}</span> : null}
                  {selection.questions?.length ? <span className="rounded-full bg-black/[.04] px-3 py-1.5">{selection.questions.length} booking question{selection.questions.length === 1 ? "" : "s"}</span> : null}
                </div>
                <a href={`/activities/hotelbeds-book?selectionToken=${encodeURIComponent(selection.selectionToken)}`} className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                  Review & book →
                </a>
              </article>
            ))}
            {busy === "details" ? <div className="rounded-[1.75rem] bg-white p-8 text-sm text-black/50">Checking live Hotelbeds rates…</div> : null}
          </div>
        )}
      </section>
    </div>
  );
}
