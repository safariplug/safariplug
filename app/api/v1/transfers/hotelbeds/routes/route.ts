import { NextResponse } from "next/server";
import {
  getHotelbedsTransferRoutes,
  type HotelbedsTransferRoute,
} from "@/lib/integrations/hotelbeds/transfers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function cacheEnabled() {
  return process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_CACHE_ENABLED?.trim().toLowerCase() === "true";
}

function extractRoutes(payload: unknown): HotelbedsTransferRoute[] {
  if (Array.isArray(payload)) return payload as HotelbedsTransferRoute[];
  if (!payload || typeof payload !== "object") return [];
  const row = payload as Record<string, unknown>;
  for (const key of ["routes", "results", "items"]) {
    if (Array.isArray(row[key])) return row[key] as HotelbedsTransferRoute[];
  }
  return [];
}

function sanitizeRoute(route: HotelbedsTransferRoute) {
  const fromType = String(route.from?.type || "").trim().toUpperCase();
  const fromCode = String(route.from?.code || "").trim();
  const toType = String(route.to?.type || "").trim().toUpperCase();
  const toCode = String(route.to?.code || "").trim();
  if (!fromType || !fromCode || !toType || !toCode) return null;
  return {
    code: String(route.code || `${fromType}-${fromCode}-${toType}-${toCode}`),
    from: { type: fromType, code: fromCode },
    to: { type: toType, code: toCode },
  };
}

export async function GET() {
  return NextResponse.json({
    provider: "hotelbeds",
    product: "transfers",
    routeCatalogueEnabled: cacheEnabled(),
    supplierRequestMade: false,
  });
}

export async function POST(request: Request) {
  if (!cacheEnabled()) {
    return NextResponse.json(
      {
        error: "hotelbeds_transfer_routes_unavailable",
        message:
          "Hotelbeds Transfers route discovery is temporarily unavailable while supplier Cache Routes access is being confirmed.",
        supplierRequestMade: false,
      },
      { status: 503 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 });
  }

  const destinationCode = String(body.destinationCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(destinationCode)) {
    return NextResponse.json(
      { error: "invalid_destination", message: "Enter a valid destination code." },
      { status: 400 }
    );
  }

  try {
    const supplier = await getHotelbedsTransferRoutes(destinationCode, 50, 0);
    const routes = extractRoutes(supplier)
      .map(sanitizeRoute)
      .filter((route): route is NonNullable<typeof route> => Boolean(route));

    return NextResponse.json({
      provider: "hotelbeds",
      product: "transfers",
      destinationCode,
      supplierRequestCount: 1,
      routes,
      resultCount: routes.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "hotelbeds_transfer_routes_error",
        message: error instanceof Error ? error.message : "Hotelbeds Transfers route lookup failed.",
        supplierRequestCount: 1,
      },
      { status: 502 }
    );
  }
}
