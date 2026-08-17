"use client";

import { useRouter, useSearchParams } from "next/navigation";

const categories = [
  "All Events",
  "Music & Nightlife",
  "Food & Drink",
  "Comedy",
  "Culture",
  "Adventure",
  "Sports",
  "Family",
  "Business",
];

const dates = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This Weekend" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export default function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory =
    searchParams.get("category") || "All Events";

  const currentWhen =
    searchParams.get("when") || "upcoming";

  function updateFilter(
    key: "category" | "when",
    value: string
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (
      (key === "category" && value === "All Events") ||
      (key === "when" && value === "upcoming")
    ) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`/events?${params.toString()}`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">

      {/* CATEGORY */}

      <div>

        <label
          htmlFor="event-category"
          className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
        >
          Category
        </label>

        <select
          id="event-category"
          value={currentCategory}
          onChange={(event) =>
            updateFilter(
              "category",
              event.target.value
            )
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        >
          {categories.map((category) => (
            <option
              key={category}
              value={category}
            >
              {category}
            </option>
          ))}
        </select>

      </div>

      {/* WHEN */}

      <div>

        <label
          htmlFor="event-when"
          className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
        >
          When
        </label>

        <select
          id="event-when"
          value={currentWhen}
          onChange={(event) =>
            updateFilter(
              "when",
              event.target.value
            )
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        >
          {dates.map((date) => (
            <option
              key={date.value}
              value={date.value}
            >
              {date.label}
            </option>
          ))}
        </select>

      </div>

    </div>
  );
}