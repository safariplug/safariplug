"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface StatusResponse {
  status: "confirmed" | "payment_pending" | "failed" | "cancelled";
  ledger?: { retail_amount?: number; currency?: string; booking_status?: string };
  providerBooking?: {
    bookingReferenceId?: string;
    status?: string;
    paymentStatus?: string;
    hotel?: { name?: string; city?: string; country?: string };
    checkIn?: string;
    checkOut?: string;
  };
  itineraryItem?: { id?: string } | null;
  message?: string;
}

export default function HotelBookingResultPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const preparedBookingId = params.get("bookingId") || params.get("preparedBookingId") || "";
  const tripId = params.get("tripId") || "";
  const [state, setState] = useState<"loading" | "confirmed" | "pending" | "failed">("loading");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!preparedBookingId) {
      setState("failed");
      setError("We could not identify this hotel booking.");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempt = 0;

    const check = async () => {
      attempt += 1;
      setAttempts(attempt);
      try {
        const response = await fetch("/api/v1/hotels/locktrip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "status", preparedBookingId, tripId: tripId || undefined }),
          cache: "no-store",
        });
        const result = await response.json() as StatusResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error(result.message || "Unable to verify your hotel booking.");
        setData(result);
        if (result.status === "confirmed") {
          setState("confirmed");
          return;
        }
        if (result.status === "failed" || result.status === "cancelled") {
          setState("failed");
          setError(result.message || (result.status === "cancelled" ? "The hotel booking was cancelled." : "The hotel booking was not completed."));
          return;
        }
        setState("pending");
        if (attempt < 12) timer = window.setTimeout(check, 5000);
      } catch (err) {
        if (cancelled) return;
        setState("failed");
        setError(err instanceof Error ? err.message : "Unable to verify your hotel booking.");
      }
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [preparedBookingId, tripId]);

  const booking = data?.providerBooking;
  const hotel = booking?.hotel;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        {state === "loading" && <Status title="Checking your hotel booking…" body="We are confirming the payment and reservation with LockTrip." attempts={attempts} />}
        {state === "pending" && <Status title="Payment received — booking is processing" body={attempts < 12 ? "LockTrip is still confirming the reservation. We will keep checking automatically." : "LockTrip is taking longer than usual to confirm the reservation. You can check again below."} attempts={attempts} />}
        {state === "failed" && <Status title="Hotel booking needs attention" body={error || "The reservation could not be confirmed."} attempts={attempts} />}
        {state === "confirmed" && (
          <>
            <div className="mb-6 text-4xl">✓</div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Hotel confirmed</p>
            <h1 className="mt-2 text-3xl font-bold">{hotel?.name || "Your hotel stay"}</h1>
            <p className="mt-2 text-gray-600">{hotel?.city}{hotel?.country ? `, ${hotel.country}` : ""}</p>
            <div className="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-5 sm:grid-cols-2">
              <div><p className="text-xs text-gray-500">Check-in</p><p className="font-semibold">{booking?.checkIn || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Check-out</p><p className="font-semibold">{booking?.checkOut || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Booking reference</p><p className="font-semibold">{booking?.bookingReferenceId || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><p className="font-semibold">Confirmed</p></div>
            </div>
            <p className="mt-6 text-sm text-gray-600">Your confirmed hotel has been added to your SafariPlug trip itinerary.</p>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {state === "failed" && <button className="rounded-xl border px-4 py-2 font-medium" onClick={() => window.location.reload()}>Check again</button>}
          {state === "pending" && attempts >= 12 && <button className="rounded-xl border px-4 py-2 font-medium" onClick={() => window.location.reload()}>Check again</button>}
          <Link className="rounded-xl bg-black px-4 py-2 font-medium text-white" href={tripId ? `/trips/${encodeURIComponent(tripId)}` : "/trips"}>View my trip</Link>
          <Link className="rounded-xl border px-4 py-2 font-medium" href="/hotels">Find another hotel</Link>
        </div>
      </div>
    </main>
  );
}

function Status({ title, body, attempts }: { title: string; body: string; attempts: number }) {
  return <><div className="mb-6 h-10 w-10 animate-pulse rounded-full border-4 border-gray-200 border-t-black" /><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-gray-600">{body}</p>{attempts > 0 && <p className="mt-3 text-xs text-gray-400">Verification attempt {attempts} of 12</p>}</>;
}
