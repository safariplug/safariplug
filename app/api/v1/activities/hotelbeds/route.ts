import { NextResponse } from "next/server";
import {
  getHotelbedsActivityDetails,
  hotelbedsActivitiesConfigured,
  searchHotelbedsActivities,
} from "@/lib/integrations/hotelbeds/activities";
import {
  extractHotelbedsActivitySelections,
  sanitizeHotelbedsActivitySearch,
} from "@/lib/integrations/hotelbeds/activity-checkout";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function fail(status: number, message: string) {
  return NextResponse.json({ error: "hotelbeds_activities_error", message }, { status });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePaxes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const age = Number((row as { age?: unknown })?.age);
      return Number.isFinite(age) && age >= 0 && age <= 120 ? { age } : null;
    })
    .filter((row): row is { age: number } => Boolean(row));
}

export async function GET() {
  return NextResponse.json({
    provider: "hotelbeds",
    product: "activities",
    configured: hotelbedsActivitiesConfigured(),
    search_exposed: true,
    details_exposed: true,
    supplierRequestMade: false,
    bookingCreated: false,
  });
}

export async function POST(request: Request) {
  if (!hotelbedsActivitiesConfigured()) {
    return fail(503, "Hotelbeds Activities credentials are not configured.");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON body.");
  }

  const action = String(body.action || "search").trim().toLowerCase();
  const from = String(body.from || "");
  const to = String(body.to || "");
  const paxes = parsePaxes(body.paxes);
  const language = String(body.language || "en").slice(0, 5);

  if (!validDate(from) || !validDate(to) || to < from) {
    return fail(400, "Valid from/to dates are required.");
  }
  if (!paxes.length) return fail(400, "At least one valid passenger age is required.");

  try {
    if (action === "search") {
      const destinationCode = String(body.destinationCode || "").trim();
      if (!destinationCode) return fail(400, "destinationCode is required.");
      const supplier = await searchHotelbedsActivities({
        destinationCode,
        from,
        to,
        paxes,
        language,
        text: typeof body.text === "string" ? body.text.slice(0, 120) : undefined,
      });
      const results = sanitizeHotelbedsActivitySearch(supplier);
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        action,
        supplierRequestCount: 1,
        bookingCreated: false,
        resultCount: results.length,
        results,
        search: { destinationCode, from, to, ages: paxes.map((pax) => pax.age) },
      });
    }

    if (action === "details") {
      const code = String(body.code || "").trim();
      if (!code) return fail(400, "code is required.");
      const supplier = await getHotelbedsActivityDetails({ code, from, to, paxes, language });
      const results = extractHotelbedsActivitySelections(supplier, paxes);
      return NextResponse.json({
        provider: "hotelbeds",
        product: "activities",
        action,
        supplierRequestCount: 1,
        bookingCreated: false,
        resultCount: results.length,
        results,
      });
    }

    return fail(400, "Unsupported Hotelbeds Activities action.");
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Hotelbeds Activities request failed.");
  }
}
