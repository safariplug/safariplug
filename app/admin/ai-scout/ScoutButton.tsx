"use client";

import { useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

const featuredLocations = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Zanzibar",
  "Kampala",
  "Kigali",
  "Dar es Salaam",
  "Addis Ababa",
  "Accra",
  "Lagos",
  "Abuja",
  "Cape Town",
  "Johannesburg",
  "Durban",
  "Marrakech",
  "Cairo",
];

export default function ScoutButton() {
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("Music & Nightlife");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runScout() {
    const destination = location.trim();
    if (!destination) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/scout/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ location: destination, category }),
      });

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      let result: { error?: string; message?: string; run_id?: string; queued?: boolean } = {};

      if (contentType.includes("application/json")) {
        try {
          result = JSON.parse(raw) as typeof result;
        } catch {
          result = {};
        }
      }

      if (!response.ok) {
        const detail = result.error || raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
        throw new Error(detail ? `Scout request failed (${response.status}): ${detail}` : `Scout request failed (${response.status}).`);
      }

      if (!contentType.includes("application/json")) {
        throw new Error(`Scout server returned an unexpected response (${response.status}).`);
      }

      setMessage(result.message || `${destination} / ${category} was added to the Scout queue.`);
      setLocation("");
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("SCOUT BUTTON ERROR:", error);
      setMessage(error instanceof Error ? error.message : "Scout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <div>
        <label htmlFor="scout-location" className="mb-2 block text-sm font-medium text-gray-700">
          Destination
        </label>
        <input
          id="scout-location"
          list="safariplug-scout-destinations"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Choose or enter any African city or destination"
          aria-label="Scout destination"
          className="w-full rounded-lg border p-3"
        />
        <datalist id="safariplug-scout-destinations">
          {featuredLocations.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border p-3"
      >
        {EVENT_CATEGORIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <button
        onClick={runScout}
        disabled={loading || !location.trim()}
        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
      >
        {loading ? "Adding to Queue..." : "Queue Scout Mission"}
      </button>

      {message && <p className="text-sm font-medium text-gray-700">{message}</p>}
      <p className="text-xs text-gray-500">
        Missions are processed by the Scout worker. You can queue another destination while one is running.
      </p>
    </div>
  );
}
