"use client";

import { useState } from "react";
import Link from "next/link";

export default function SavedExperienceActions({ eventId, savedId, selectedTripId }: { eventId: string; savedId: string; selectedTripId?: string }) {
  const [state, setState] = useState<"idle" | "adding" | "added" | "removing" | "removed" | "error">("idle");
  const [tripId, setTripId] = useState<string | null>(selectedTripId || null);
  const [message, setMessage] = useState("");

  async function addToTrip() {
    setState("adding");
    setMessage("");
    try {
      const response = await fetch(selectedTripId ? "/api/trips/items" : "/api/trips/from-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selectedTripId ? { tripId: selectedTripId, eventId } : { eventId }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (!response.ok) throw new Error(body.error || "Could not add this experience.");
      setTripId(body.trip?.id || selectedTripId || null);
      setMessage(body.added === false ? "Already in your journey" : "Added to your journey");
      setState("added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add this experience.");
      setState("error");
    }
  }

  async function removeSaved() {
    if (!window.confirm("Remove this experience from your saved collection?")) return;
    setState("removing");
    setMessage("");
    try {
      const response = await fetch(`/api/account/saved?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/account/saved")}`;
        return;
      }
      if (!response.ok) throw new Error(body.error || "Could not remove this experience.");
      setState("removed");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove this experience.");
      setState("error");
    }
  }

  if (state === "removed") return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2" onClick={(event) => event.preventDefault()}>
      {state === "added" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">✓ {message}</span>
          {tripId && <Link href={`/account/trips/${tripId}`} className="rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/5">Open journey →</Link>}
        </div>
      ) : (
        <button type="button" onClick={addToTrip} disabled={state === "adding" || state === "removing"} className="rounded-full bg-[#e7c98d] px-4 py-2 text-xs font-black text-black disabled:cursor-wait disabled:opacity-60">
          {state === "adding" ? "Adding…" : selectedTripId ? "＋ Add to This Trip" : "＋ Add to My Trip"}
        </button>
      )}
      <button type="button" onClick={removeSaved} disabled={state === "adding" || state === "removing"} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400 hover:border-red-400/30 hover:text-red-300 disabled:opacity-60">
        {state === "removing" ? "Removing…" : "Remove"}
      </button>
      {state === "error" && <span className="w-full text-xs text-red-300">{message}</span>}
    </div>
  );
}
