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
  { label: "Upcoming", value: "upcoming" },
  { label: "Today", value: "today" },
  { label: "This Weekend", value: "weekend" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

const cities = [
  "All Cities",
  "Nairobi",
  "Mombasa",
  "Diani",
  "Kilifi",
  "Mtwapa",
  "Malindi",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam",
];

export default function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory =
    searchParams.get("category") || "All Events";

  const currentWhen =
    searchParams.get("when") || "upcoming";

  const currentCity =
    searchParams.get("city") || "All Cities";

  function updateFilter(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (
      !value ||
      value === "All Events" ||
      value === "All Cities" ||
      value === "upcoming"
    ) {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    const queryString = params.toString();

    router.push(
      queryString
        ? `/events?${queryString}`
        : "/events"
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 md:grid-cols-3">

      {/* CITY */}

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
          City
        </label>

        <select
          value={currentCity}
          onChange={(event) =>
            updateFilter("city", event.target.value)
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        >
          {cities.map((city) => (
            <option
              key={city}
              value={city}
            >
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* CATEGORY */}

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
          Category
        </label>

        <select
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
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
          When
        </label>

        <select
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