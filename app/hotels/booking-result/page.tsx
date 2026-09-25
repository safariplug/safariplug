"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Voucher = {
  booking_reference?: string;
  agency_reference?: string | null;
  hotel?: { name?: string; address?: string; destination?: string | null };
  holder_name?: string;
  check_in?: string;
  check_out?: string;
  rooms?: Array<{ room_type?: string; board_type?: string; passengers?: Array<{ name?: string; type?: string; age?: number }>; rate_comments?: string[] }>;
  payment_notice?: string | null;
};

type StatusResponse = {
  provider?: string;
  status: "confirmed" | "payment_pending" | "failed" | "cancelled";
  supplierStatus?: string;
  reconciliation?: string;
  ledger?: { retail_amount?: number; customer_retail_amount?: number; currency?: string; customer_currency?: string; booking_status?: string; payment_status?: string; provider_booking_reference?: string };
  providerBooking?: {
    bookingReferenceId?: string;
    status?: string;
    paymentStatus?: string;
    hotel?: { name?: string; city?: string; country?: string };
    checkIn?: string;
    checkOut?: string;
    booking?: { reference?: string; status?: string; hotel?: { name?: string } };
  };
  voucher?: Voucher | null;
  itineraryItem?: { id?: string } | null;
  message?: string;
};

export default function HotelBookingResultPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const bookingId = params.get("bookingId") || params.get("preparedBookingId") || "";
  const tripId = params.get("tripId") || "";
  const provider = params.get("provider") === "hotelbeds" ? "hotelbeds" : "locktrip";
  const endpoint = provider === "hotelbeds" ? "/api/v1/hotels/hotelbeds" : "/api/v1/hotels/locktrip";
  const [state, setState] = useState<"loading" | "confirmed" | "pending" | "failed" | "cancelled">("loading");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cancelPreview, setCancelPreview] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(provider === "hotelbeds" ? { action, bookingId, tripId: tripId || undefined, ...extra } : { action, preparedBookingId: bookingId, tripId: tripId || undefined, ...extra }),
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to verify your hotel booking.");
    return result;
  }

  useEffect(() => {
    if (!bookingId) { setState("failed"); setError("We could not identify this hotel booking."); return; }
    let cancelled = false;
    let timer: number | undefined;
    let attempt = 0;
    const check = async () => {
      attempt += 1; setAttempts(attempt);
      try {
        const result = await call("status") as StatusResponse;
        if (cancelled) return;
        setData(result);
        if (result.status === "confirmed") { setState("confirmed"); return; }
        if (result.status === "failed") { setState("failed"); setError(result.message || "The hotel booking was not completed."); return; }
        if (result.status === "cancelled") { setState("cancelled"); return; }
        setState("pending");
        if (result.reconciliation === "manual_required") return;
        if (attempt < 12) timer = window.setTimeout(check, 5000);
      } catch (err) {
        if (cancelled) return;
        setState("failed"); setError(err instanceof Error ? err.message : "Unable to verify your hotel booking.");
      }
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [bookingId, tripId, endpoint]);

  async function previewCancellation() {
    setCancelling(true); setError("");
    try { const result = await call("cancel_preview"); setCancelPreview(result.preview || result); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to preview cancellation."); }
    finally { setCancelling(false); }
  }

  async function confirmCancellation() {
    setCancelling(true); setError("");
    try { const result = await call("cancel", { confirmCancellation: true }); setData(result); setState("cancelled"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to cancel booking."); }
    finally { setCancelling(false); }
  }

  const booking = data?.providerBooking;
  const hotelName = data?.voucher?.hotel?.name || booking?.hotel?.name || booking?.booking?.hotel?.name || "Your hotel stay";
  const reference = data?.voucher?.booking_reference || data?.ledger?.provider_booking_reference || booking?.bookingReferenceId || booking?.booking?.reference || "—";
  const checkIn = data?.voucher?.check_in || booking?.checkIn || "—";
  const checkOut = data?.voucher?.check_out || booking?.checkOut || "—";

  return <main className="mx-auto max-w-2xl px-6 py-16"><div className="rounded-3xl border bg-white p-8 shadow-sm">
    {state === "loading" && <Status title="Checking your hotel booking…" body={`We are confirming payment and reservation with ${provider === "hotelbeds" ? "Hotelbeds" : "LockTrip"}.`} attempts={attempts} />}
    {state === "pending" && <Status
      title={
        data?.reconciliation === "manual_required"
          ? data?.ledger?.payment_status === "paid"
            ? "Payment received — supplier confirmation needs review"
            : "Checkout needs review"
          : data?.ledger?.payment_status === "paid"
            ? "Payment received — booking is processing"
            : "Waiting for payment confirmation"
      }
      body={
        data?.message ||
        (data?.ledger?.payment_status === "paid"
          ? attempts < 12
            ? `${provider === "hotelbeds" ? "Hotelbeds" : "LockTrip"} is still confirming the reservation.`
            : "The supplier is taking longer than usual. You can check again below."
          : "SafariPlug is waiting for M-Pesa to confirm the payment before the hotel reservation can be finalized.")
      }
      attempts={attempts}
    />}
    {state === "failed" && <Status title="Hotel booking needs attention" body={error || "The reservation could not be confirmed."} attempts={attempts} />}
    {state === "cancelled" && <><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Booking cancelled</p><h1 className="mt-2 text-3xl font-bold">{hotelName}</h1><p className="mt-4 text-sm text-gray-600">Supplier cancellation is recorded. Any customer refund due is handled separately and is not automatically issued by this cancellation action.</p></>}
    {state === "confirmed" && <><div className="mb-6 text-4xl">✓</div><p className="text-sm font-semibold uppercase tracking-wide text-green-700">Hotel confirmed</p><h1 className="mt-2 text-3xl font-bold">{hotelName}</h1><div className="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-5 sm:grid-cols-2"><div><p className="text-xs text-gray-500">Check-in</p><p className="font-semibold">{checkIn}</p></div><div><p className="text-xs text-gray-500">Check-out</p><p className="font-semibold">{checkOut}</p></div><div><p className="text-xs text-gray-500">Booking reference</p><p className="font-semibold">{reference}</p></div><div><p className="text-xs text-gray-500">Provider</p><p className="font-semibold capitalize">{provider}</p></div></div>{data?.voucher ? <div className="mt-6 rounded-2xl border p-5"><h2 className="font-semibold">Booking voucher</h2><p className="mt-2 text-sm text-gray-600">Holder: {data.voucher.holder_name || "—"}</p><p className="text-sm text-gray-600">{data.voucher.hotel?.address || ""}</p>{data.voucher.rooms?.map((room, index) => <div key={index} className="mt-3 text-sm text-gray-600"><p>{room.room_type || "Room"} · {room.board_type || "Board"}</p>{room.rate_comments?.map((comment, i) => <p key={i} className="text-xs text-gray-500">{comment}</p>)}</div>)}{data.voucher.payment_notice ? <p className="mt-4 text-xs leading-5 text-gray-500">{data.voucher.payment_notice}</p> : null}</div> : null}{provider === "hotelbeds" ? <div className="mt-6 rounded-2xl border p-5"><h2 className="font-semibold">Manage booking</h2>{!cancelPreview ? <button disabled={cancelling} onClick={previewCancellation} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">{cancelling ? "Checking…" : "Preview cancellation"}</button> : <><p className="mt-3 text-sm text-gray-600">Hotelbeds cancellation simulation completed. Review the supplier response before confirming.</p><details className="mt-3 text-xs text-gray-500"><summary>Supplier simulation details</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(cancelPreview, null, 2)}</pre></details><button disabled={cancelling} onClick={confirmCancellation} className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{cancelling ? "Cancelling…" : "Confirm cancellation"}</button></>}</div> : null}</>}
    {error && state !== "failed" ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-8 flex flex-wrap gap-3">{(state === "failed" || (state === "pending" && attempts >= 12)) && <button className="rounded-xl border px-4 py-2 font-medium" onClick={() => window.location.reload()}>Check again</button>}<Link className="rounded-xl bg-black px-4 py-2 font-medium text-white" href={tripId ? `/account/trips/${encodeURIComponent(tripId)}` : "/account/hotels"}>{tripId ? "View my trip" : "My hotel bookings"}</Link><Link className="rounded-xl border px-4 py-2 font-medium" href={tripId ? `/hotels?tripId=${encodeURIComponent(tripId)}` : "/hotels"}>Find another hotel</Link></div>
  </div></main>;
}

function Status({ title, body, attempts }: { title: string; body: string; attempts: number }) {
  return <><div className="mb-6 h-10 w-10 animate-pulse rounded-full border-4 border-gray-200 border-t-black" /><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-gray-600">{body}</p>{attempts > 0 && <p className="mt-3 text-xs text-gray-400">Verification attempt {attempts} of 12</p>}</>;
}
