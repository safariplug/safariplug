"use client";

import { useState } from "react";
import Link from "next/link";

export default function AddToTripButton({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);

  async function addToTrip() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/trips/from-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.href = `/admin/login?next=${encodeURIComponent(`/events/${eventId}`)}`;
        return;
      }
      if (!response.ok) {
        setState("error");
        setMessage(body.error || "Could not add this experience.");
        return;
      }
      setTripId(body.trip?.id || null);
      setState("success");
      setMessage(body.added === false ? "Already in your journey" : `Added to ${body.trip?.title || "your journey"}`);
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-semibold text-amber-300">✓ {message}</p>
        {tripId && <Link href={`/account/trips/${tripId}`} className="mt-2 inline-block text-sm font-semibold text-white/80 hover:text-white">Open your journey →</Link>}
      </div>
    );
  }

  return (
    <>
      <button onClick={addToTrip} disabled={state === "loading"} className="mt-8 block w-full rounded-full border border-[#e7c98d] px-6 py-4 text-center font-bold text-[#e7c98d] transition hover:bg-[#e7c98d]/10 disabled:cursor-wait disabled:opacity-60">
        {state === "loading" ? "Adding…" : "＋ Add to My Trip"}
      </button>
      {state === "error" && <p className="mt-3 text-center text-sm text-red-300">{message}</p>}
    </>
  );
}
