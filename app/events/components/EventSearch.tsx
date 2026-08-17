"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type EventSearchProps = {
  initialSearch?: string;
};

export default function EventSearch({
  initialSearch = "",
}: EventSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = search.trim();

    const params = new URLSearchParams(searchParams.toString());

    if (!value) {
      params.delete("search");
    } else {
      params.set("search", value);
    }

    const query = params.toString();

    router.push(query ? `/events?${query}` : "/events");
  }

  function clearSearch() {
    setSearch("");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");

    const query = params.toString();

    router.push(query ? `/events?${query}` : "/events");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="flex-1">
          <label
            htmlFor="event-search"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            Search events
          </label>

          <input
            id="event-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search concerts, parties, festivals..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-orange-500 focus:bg-white"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white hover:bg-orange-600"
          >
            Search
          </button>

          <button
            type="button"
            onClick={clearSearch}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}