import { NextResponse } from "next/server";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

function fail(status: number, message: string) {
  return NextResponse.json({ error: "locktrip_error", message }, { status });
}

async function registeredToken(adapter: LockTripHotelAdapter) {
  const email = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_EMAIL?.trim();
  const password = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("SafariPlug's registered LockTrip account is not configured.");
  }
  return adapter.login(email, password);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return fail(error.status, error.message);
    return fail(500, "Unable to verify admin access.");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON body.");
  }

  const action = String(body.action || "").trim();
  const adapter = new LockTripHotelAdapter();

  try {
    const token = await registeredToken(adapter);

    if (action === "list") {
      const requested = String(body.type || "UPCOMING").toUpperCase();
      const type = (["UPCOMING", "COMPLETED", "CANCELLED", "PENDING"] as const).find((value) => value === requested) || "UPCOMING";
      const data = await adapter.listBookings(token, type);
      return NextResponse.json({ provider: "locktrip", action, data });
    }

    if (action === "details") {
      const bookingId = String(body.bookingId || "");
      if (!bookingId) return fail(400, "bookingId is required.");
      const data = await adapter.getBookingDetails(token, bookingId);
      return NextResponse.json({ provider: "locktrip", action, data });
    }

    if (action === "cancel") {
      const bookingId = String(body.bookingId || "");
      const confirmed = body.confirmed === true;
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;
      if (!bookingId) return fail(400, "bookingId is required.");
      const data = await adapter.cancelBooking(token, bookingId, confirmed, reason);
      return NextResponse.json({
        provider: "locktrip",
        action,
        mode: confirmed ? "execute" : "preview",
        data,
      });
    }

    return fail(400, "Unsupported booking-management action.");
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "LockTrip booking management failed.");
  }
}
