import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";

export const dynamic = "force-dynamic";

function fail(status: number, message: string) {
  return NextResponse.json({ error: "hotelbeds_error", message }, { status });
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function bookingEnabled() {
  return process.env.SAFARIPLUG_HOTEL_HOTELBEDS_BOOKING_ENABLED?.trim().toLowerCase() === "true";
}

function environment() {
  return (process.env.SAFARIPLUG_HOTEL_HOTELBEDS_ENV || "test").trim().toLowerCase();
}

type Pax = { roomId: number; type: "AD" | "CH"; name: string; surname: string; age?: number };
type BookingRoom = { rateKey: string; paxes: Pax[] };

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return fail(401, "Authentication required.");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON body.");
  }

  const action = String(body.action || "").trim().toLowerCase();
  const adapter = new HotelbedsHotelAdapter();

  if (!adapter.credentialsPresent()) {
    return fail(503, "Hotelbeds is not fully configured. API key, secret and mTLS credentials are required.");
  }

  try {
    if (action === "checkrate") {
      const rateKey = String(body.rateKey || "").trim();
      if (!rateKey) return fail(400, "rateKey is required.");
      const data = await adapter.checkRate(rateKey);
      return NextResponse.json({ provider: "hotelbeds", action, data });
    }

    if (action === "book") {
      if (!bookingEnabled()) return fail(409, "Hotelbeds booking is disabled until SafariPlug explicitly enables test booking.");
      if (environment() !== "test") return fail(409, "Direct Hotelbeds production booking remains disabled until SafariPlug payment and certification gates are complete.");

      const holderSource = body.holder && typeof body.holder === "object" && !Array.isArray(body.holder)
        ? body.holder as Record<string, unknown>
        : {};
      const holder = {
        name: String(holderSource.name || "").trim(),
        surname: String(holderSource.surname || "").trim(),
      };
      if (!holder.name || !holder.surname) return fail(400, "holder name and surname are required.");

      const roomsSource = Array.isArray(body.rooms) ? body.rooms : [];
      const rooms: BookingRoom[] = [];
      for (const rawRoom of roomsSource) {
        if (!rawRoom || typeof rawRoom !== "object" || Array.isArray(rawRoom)) continue;
        const room = rawRoom as Record<string, unknown>;
        const rateKey = String(room.rateKey || "").trim();
        const rawPaxes = Array.isArray(room.paxes) ? room.paxes : [];
        const paxes: Pax[] = rawPaxes.flatMap((rawPax) => {
          if (!rawPax || typeof rawPax !== "object" || Array.isArray(rawPax)) return [];
          const pax = rawPax as Record<string, unknown>;
          const type = String(pax.type || "").toUpperCase();
          const name = String(pax.name || "").trim();
          const surname = String(pax.surname || "").trim();
          const roomId = Number(pax.roomId);
          if (!rateKey || (type !== "AD" && type !== "CH") || !name || !surname || !Number.isFinite(roomId) || roomId < 1) return [];
          const age = pax.age == null ? undefined : Number(pax.age);
          return [{ roomId, type: type as "AD" | "CH", name, surname, ...(Number.isFinite(age) ? { age } : {}) }];
        });
        if (rateKey && paxes.length) rooms.push({ rateKey, paxes });
      }
      if (!rooms.length) return fail(400, "At least one valid room with rateKey and passenger details is required.");

      const requestedReference = String(body.clientReference || `SP-${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
      const clientReference = requestedReference || `SP-${Date.now()}`.slice(0, 20);
      const remark = typeof body.remark === "string" ? body.remark.trim().slice(0, 2000) : undefined;
      const toleranceRaw = Number(body.tolerance ?? 2);
      const tolerance = Number.isFinite(toleranceRaw) && toleranceRaw >= 0 && toleranceRaw <= 10 ? toleranceRaw : 2;

      const data = await adapter.book({ holder, rooms, clientReference, remark, tolerance });
      return NextResponse.json({
        provider: "hotelbeds",
        environment: "test",
        action,
        data,
        warning: "Hotelbeds test bookings do not create real property reservations or charges.",
      });
    }

    return fail(400, "Unsupported Hotelbeds action.");
  } catch (error) {
    return fail(502, error instanceof Error ? error.message : "Hotelbeds request failed.");
  }
}
