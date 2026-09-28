import { NextResponse } from "next/server";
import {
  getViatorDestinationsWithMeta,
  getViatorProductWithMeta,
  viatorBookingEnabled,
  viatorConfigured,
  viatorEnvironment,
} from "@/lib/integrations/viator/client";

export const dynamic = "force-dynamic";

function fail(status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: "viator_error", message, ...details }, { status });
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
      return NextResponse.json({ provider: "viator", action, product, requestMeta: meta });
    }

    return fail(400, "Unsupported Viator action.");
  } catch (error) {
    const candidate = error as Error & { status?: number; trackingId?: string };
    return fail(candidate.status || 502, candidate.message || "Viator request failed.", {
      trackingId: candidate.trackingId || null,
    });
  }
}
