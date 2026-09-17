import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import {
  HotelbedsProductRequestError,
  hotelbedsProductConfig,
} from "@/lib/integrations/hotelbeds/client";
import {
  getHotelbedsTransferRoutes,
  type HotelbedsTransferRoute,
} from "@/lib/integrations/hotelbeds/transfers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function extractRoutes(payload: unknown): HotelbedsTransferRoute[] {
  if (Array.isArray(payload)) return payload as HotelbedsTransferRoute[];
  if (!payload || typeof payload !== "object") return [];
  const candidate = payload as Record<string, unknown>;
  const keys = ["routes", "results", "items"];
  for (const key of keys) {
    if (Array.isArray(candidate[key])) return candidate[key] as HotelbedsTransferRoute[];
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

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { destinationCode?: string };
    const destinationCode = String(body.destinationCode || "").trim().toUpperCase();

    if (!/^[A-Z0-9_-]{2,20}$/.test(destinationCode)) {
      return NextResponse.json(
        { error: "Enter a valid Hotelbeds Transfers destination code." },
        { status: 400 }
      );
    }

    const config = hotelbedsProductConfig("transfers");
    const started = Date.now();
    const supplier = await getHotelbedsTransferRoutes(destinationCode, 25, 0);
    const routes = extractRoutes(supplier)
      .map(sanitizeRoute)
      .filter((route): route is NonNullable<typeof route> => Boolean(route));

    return NextResponse.json({
      ok: true,
      product: "transfers",
      environment: config.environment,
      destinationCode,
      supplierRequestCount: 1,
      bookingCreated: false,
      latencyMs: Date.now() - started,
      resultCount: routes.length,
      routes,
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    const supplierError = error instanceof HotelbedsProductRequestError ? error : null;
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Hotelbeds Transfers route catalogue lookup failed.",
        supplierRequestCount: status === 502 ? 1 : 0,
        bookingCreated: false,
        ...(supplierError
          ? {
              supplierStatus: supplierError.status,
              ...(supplierError.code ? { supplierCode: supplierError.code } : {}),
            }
          : {}),
      },
      { status }
    );
  }
}
