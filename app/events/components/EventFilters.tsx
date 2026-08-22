"use client";

import { useRouter, useSearchParams } from "next/navigation";

type EventFiltersProps = {
  cities: string[];
  categories: string[];
  selectedCity: string;
  selectedCategory: string;
  selectedWhen: string;
};

const WHEN_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "tonight", label: "Tonight" },
  { value: "today", label: "Today" },
  { value: "this-weekend", label: "This Weekend" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
];

export default function EventFilters({
  cities,
  categories,
  selectedCity,
  selectedCategory,
  selectedWhen,
}: EventFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(
    name: "city" | "category" | "when",
    value: string
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "all") {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    const query = params.toString();

    if (query) {
      router.push("/events?" + query);
    } else {
      router.push("/events");
    }
  }

  function clearFilters() {
    router.push("/events");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="event-city"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            City
          </label>

          <select
            id="event-city"
            value={selectedCity}
            onChange={(event) =>
              updateFilter("city", event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white"
          >
            <option value="all">All Cities</option>

            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="event-category"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            Category
          </label>

          <select
            id="event-category"
            value={selectedCategory}
            onChange={(event) =>
              updateFilter("category", event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white"
          >
            <option value="all">All Events</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="event-when"
            className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            When
          </label>

          <select
            id="event-when"
            value={selectedWhen}
            onChange={(event) =>
              updateFilter("when", event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white"
          >
            {WHEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(selectedCity !== "all" ||
        selectedCategory !== "all" ||
        selectedWhen !== "upcoming") && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-500">
            Filters applied
          </span>

          {selectedCity !== "all" && (
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
              {selectedCity}
            </span>
          )}

          {selectedCategory !== "all" && (
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
              {selectedCategory}
            </span>
          )}

          {selectedWhen !== "upcoming" && (
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
              {WHEN_OPTIONS.find(
                (option) => option.value === selectedWhen
              )?.label || selectedWhen}
            </span>
          )}

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}