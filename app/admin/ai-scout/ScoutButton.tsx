"use client";

import { useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

export default function ScoutButton() {
  const [location, setLocation] = useState("Nairobi");
  const [category, setCategory] = useState("Music & Nightlife");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runScout() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/scout/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ location, category }),
      });

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      let result: { error?: string; message?: string } = {};

      if (contentType.includes("application/json")) {
        try {
          result = JSON.parse(raw) as { error?: string; message?: string };
        } catch {
          result = {};
        }
      }

      if (!response.ok) {
        const detail = result.error || raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
        throw new Error(
          detail
            ? `Scout request failed (${response.status}): ${detail}`
            : `Scout request failed (${response.status}).`
        );
      }

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Scout server returned an unexpected response (${response.status}). The deployment may have timed out or returned an HTML error page.`
        );
      }

      setMessage(result.message || "Scout mission completed. Discoveries sent for review.");
      window.location.reload();
    } catch (error) {
      console.error("SCOUT BUTTON ERROR:", error);
      setMessage(error instanceof Error ? error.message : "Scout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <select
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="rounded-lg border p-3"
      >
        <option>Nairobi</option>
        <option>Mombasa</option>
        <option>Mtwapa</option>
        <option>Diani</option>
        <option>Kilifi</option>
        <option>Watamu</option>
        <option>Malindi</option>
        <option>Lamu</option>
        <option>Zanzibar</option>
        <option>Kampala</option>
        <option>Dar es Salaam</option>
      </select>

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
        disabled={loading}
        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
      >
        {loading ? "Running Scout..." : "Run Scout Mission"}
      </button>

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
