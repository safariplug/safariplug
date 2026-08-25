"use client";

import { useState } from "react";


export default function ScoutButton() {
  const [location, setLocation] = useState("Nairobi");
  const [category, setCategory] = useState("Events & Experiences");
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
  },
  body: JSON.stringify({
    location,
    category,
  }),
});

const result = await response.json();

if (!response.ok) {
  throw new Error(
    result.error || "Scout failed"
  );
}

      setMessage(
        "Scout mission completed. Discoveries sent for review."
      );

      window.location.reload();

    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Scout failed"
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">

      <select
        value={location}
        onChange={(e) =>
          setLocation(e.target.value)
        }
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
        onChange={(e) =>
          setCategory(e.target.value)
        }
        className="rounded-lg border p-3"
      >
        <option>Events & Experiences</option>
        <option>Music & Nightlife</option>
        <option>Food & Drink</option>
        <option>Beach</option>
        <option>Safari</option>
        <option>Adventure</option>
        <option>Culture</option>
      </select>

      <button
        onClick={runScout}
        disabled={loading}
        className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
      >
        {loading
          ? "Running Scout..."
          : "Run Scout Mission"}
      </button>

      {message && (
        <p className="text-sm">
          {message}
        </p>
      )}

    </div>
  );
}