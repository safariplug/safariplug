"use client";

import { useState } from "react";

const categories = [
  "All",
  "Music & Nightlife",
  "Food & Drink",
  "Beach",
  "Safari",
  "Adventure",
  "Culture",
  "Wellness",
];

export default function AIEventFilter({
  events,
  renderEvent,
}: {
  events: any[];
  renderEvent: (event: any) => React.ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredEvents =
    activeCategory === "All"
      ? events
      : events.filter((event) =>
          event.category
            ?.toLowerCase()
            .includes(activeCategory.toLowerCase())
        );

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2 pb-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full border px-4 py-2.5 text-xs font-black whitespace-nowrap transition ${
              activeCategory === category
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-950 hover:text-slate-950"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="space-y-5 mt-6">
        {filteredEvents.map((event) => renderEvent(event))}
      </div>
    </>
  );
}