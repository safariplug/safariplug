"use client";

import { useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

const locations = [
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
    setLoading(true);

    await fetch("/api/admin/scout/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location,
        category,
      }),
    });

    setLoading(false);

    window.location.reload();
  }

  return (
    <div className="flex flex-wrap gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <select
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="rounded-xl border px-4 py-3"
      >
        {locations.map((city) => (
          <option key={city}>{city}</option>
        ))}
      </select>

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
        disabled={loading}
        className="rounded-xl bg-[#17231d] px-6 py-3 font-bold text-white"
      >
        {loading ? "Scanning..." : "Run Discovery Scan"}
      </button>
    </div>
  );
}