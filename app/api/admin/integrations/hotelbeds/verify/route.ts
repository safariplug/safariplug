import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";
import {
  fetchHotelbedsHotelContentPage,
  hotelbedsContentConfigured,
  hotelbedsContentEnvironment,
} from "@/lib/integrations/hotels/hotelbeds-content";
import { syncOneHotelbedsContentPage } from "@/lib/integrations/hotels/hotelbeds-content-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function readiness() {
  return {
    environment: hotelbedsContentEnvironment(),
    apiKey: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY?.trim()),
    secret: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET?.trim()),
    certificate: Boolean(
      process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM?.trim()
      || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT?.trim()
    ),
    privateKey: Boolean(
      process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM?.trim()
      || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY?.trim()
    ),
    contentConfigured: hotelbedsContentConfigured(),
  };
}

async function cacheStatus() {
  const [{ count }, stateResult] = await Promise.all([
    supabaseAdmin.from("hotelbeds_hotel_content").select("hotel_code", { count: "exact", head: true }),
    supabaseAdmin
      .from("hotelbeds_content_sync_state")
      .select("sync_key,next_from,page_size,language,supplier_total,last_page_count,status,last_error,last_started_at,last_completed_at,updated_at")
      .eq("sync_key", "hotel-content")
      .maybeSingle(),
  ]);
  return { cachedHotels: count ?? 0, syncState: stateResult.data ?? null };
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ readiness: readiness(), cache: await cacheStatus() });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to inspect Hotelbeds." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({})) as { action?: string };
    const action = String(body.action || "health");

    if (action === "health") {
      const adapter = new HotelbedsHotelAdapter();
      const health = await adapter.health();
      return NextResponse.json({ readiness: readiness(), health, cache: await cacheStatus() });
    }

    if (action === "content_sample") {
      if (!hotelbedsContentConfigured()) {
        return NextResponse.json({ error: "Hotelbeds Content API credentials are not configured." }, { status: 409 });
      }
      const payload = await fetchHotelbedsHotelContentPage({ from: 1, to: 1, language: "ENG" });
      const candidate = payload as { hotels?: unknown; total?: unknown; from?: unknown; to?: unknown };
      const hotels = Array.isArray(candidate.hotels)
        ? candidate.hotels
        : candidate.hotels && typeof candidate.hotels === "object" && "hotels" in candidate.hotels
          ? (candidate.hotels as { hotels?: unknown }).hotels
          : [];
      return NextResponse.json({
        ok: true,
        environment: hotelbedsContentEnvironment(),
        sampleCount: Array.isArray(hotels) ? hotels.length : 0,
        total: candidate.total ?? null,
        from: candidate.from ?? 1,
        to: candidate.to ?? 1,
      });
    }

    if (action === "sync_one_page") {
      const result = await syncOneHotelbedsContentPage();
      return NextResponse.json({ result, cache: await cacheStatus() });
    }

    return NextResponse.json({ error: "Unsupported Hotelbeds verification action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hotelbeds verification failed." }, { status });
  }
}
