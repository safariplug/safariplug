"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TripItemActions({ tripId, itemId }: { tripId: string; itemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function removeItem() {
    if (!window.confirm("Remove this experience from your journey?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/trips/items?tripId=${encodeURIComponent(tripId)}&itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        window.alert(body.error || "Could not remove this experience.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={removeItem}
      disabled={loading}
      className="text-sm font-semibold text-zinc-500 transition hover:text-red-300 disabled:opacity-50"
    >
      {loading ? "Removing…" : "Remove"}
    </button>
  );
}
