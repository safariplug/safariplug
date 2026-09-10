"use client";

import { useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

const featuredLocations = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Kilifi",
  "Malindi",
  "Watamu",
  "Lamu",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam",
];

export default function ScoutControls() {
  const [location, setLocation] = useState("Nairobi");
  const [category, setCategory] = useState("Music & Nightlife");
  const [loading, setLoading] = useState(false);

  async function runScout() {
    const destination = location.trim();
    if (!destination) return;

    setLoading(true);

    try {
      await fetch("/api/admin/scout/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: destination,
          category,
        }),
      });
    } finally {
      setLoading(false);
    }

    window.location.reload();
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <input
          list="safariplug-featured-destinations"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Any city or destination"
          maxLength={80}
          className="min-w-[240px] rounded-xl border px-4 py-3"
          aria-label="Scout destination"
        />
        <datalist id="safariplug-featured-destinations">
          {featuredLocations.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border px-4 py-3"
        >
          {EVENT_CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <button
          onClick={runScout}
          disabled={loading || !location.trim()}
          className="rounded-xl bg-[#17231d] px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Scanning..." : "Run Discovery Scan"}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Search any destination. The suggestions above are featured locations, not a geographic restriction.
      </p>
    </div>
  );
}
