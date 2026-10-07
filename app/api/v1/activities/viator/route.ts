import { NextResponse } from "next/server";
import {
  bookViatorCart,
  cancelViatorBooking,
  checkViatorAvailability,
  getViatorBookingStatus,
  getViatorCancellationQuote,
  getViatorCancellationReasons,
  getViatorDestinationsWithMeta,
  getViatorProductWithMeta,
  holdViatorCart,
  viatorBookingEnabled,
  viatorConfigured,
  viatorEnvironment,
} from "@/lib/integrations/viator/client";
import { publicViatorProduct } from "@/lib/integrations/viator/public-product";

export const dynamic = "force-dynamic";

function fail(status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: "viator_error", message, ...details }, { status });
}

function success(action: string, data: unknown, requestMeta: unknown) {
  return NextResponse.json({ provider: "viator", action, data, requestMeta });
}

async function readJson(request: Request) {
  return request.json().catch(() => ({}));
}

function bookingRef(url: URL) {
  return String(url.searchParams.get("bookingReference") || "").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = String(url.searchParams.get("action") || "status").toLowerCase();

  if (action === "status") {
    return NextResponse.json({
      provider: "viator",
      product: "experiences",
      configured: viatorConfigured(),
      environment: viatorEnvironment(),
      displayCurrency: "USD",
      kesDisplayAllowed: false,
      bookingEnabled: viatorBookingEnabled(),
      bookingAccessRequired: !viatorBookingEnabled(),
      webOnly: true,
      paymentDataSubmissionMode: "VIATOR_FORM",
    });
  }

  if (!viatorConfigured()) {
    return fail(503, "Viator Basic API credentials are not configured yet.");
  }

  try {
    if (action === "destinations") {
      const { data: rows, meta } = await getViatorDestinationsWithMeta();
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const filtered = q
        ? rows.filter((row) => row.name?.toLowerCase().includes(q)).slice(0, 50)
        : rows.slice(0, 50);
      return NextResponse.json({ provider: "viator", action, results: filtered, requestMeta: meta });
    }

    if (action === "product") {
      const code = String(url.searchParams.get("code") || "").trim();
      if (!code) return fail(400, "Viator product code is required.");
      const { data: product, meta } = await getViatorProductWithMeta(code);
      return NextResponse.json({ provider: "viator", action, product: publicViatorProduct(product), requestMeta: meta });
    }

    if (action === "cancel-reasons") {
      const { data, meta } = await getViatorCancellationReasons();
      return success(action, data, meta);
    }

    return fail(400, "Unsupported Viator action.");
  } catch (error) {
    const candidate = error as Error & { status?: number; trackingId?: string };
    return fail(candidate.status || 502, candidate.message || "Viator request failed.", {
      trackingId: candidate.trackingId || null,
    });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = String(url.searchParams.get("action") || "").toLowerCase();

  if (!viatorConfigured()) {
    return fail(503, "Viator API credentials are not configured yet.");
  }

  try {
    const body = await readJson(request);

    if (action === "availability") {
      const { data, meta } = await checkViatorAvailability(body);
      return success(action, data, meta);
    }

    if (action === "hold") {
      const { data, meta } = await holdViatorCart(body);
      return success(action, data, meta);
    }

    if (action === "book") {
      const { data, meta } = await bookViatorCart(body);
      return success(action, data, meta);
    }

    if (action === "booking-status") {
      const { data, meta } = await getViatorBookingStatus(body);
      return success(action, data, meta);
    }

    if (action === "cancel-quote") {
      const reference = bookingRef(url);
      if (!reference) return fail(400, "bookingReference is required.");
      const { data, meta } = await getViatorCancellationQuote(reference, body);
      return success(action, data, meta);
    }

    if (action === "cancel") {
      const reference = bookingRef(url);
      if (!reference) return fail(400, "bookingReference is required.");
      const { data, meta } = await cancelViatorBooking(reference, body);
      return success(action, data, meta);
    }

    return fail(400, "Unsupported Viator action.");
  } catch (error) {
    const candidate = error as Error & { status?: number; trackingId?: string; name?: string };
    const timedOut = candidate.name === "TimeoutError" || candidate.name === "AbortError";
    return fail(
      timedOut ? 504 : candidate.status || 502,
      timedOut ? "Viator request timed out." : candidate.message || "Viator request failed.",
      { trackingId: candidate.trackingId || null }
    );
  }
}
