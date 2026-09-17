import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";
import {
  fetchHotelbedsHotelContentPage,
  hotelbedsContentConfigured,
  hotelbedsContentEnvironment,
} from "@/lib/integrations/hotels/hotelbeds-content";
import { syncOneHotelbedsContentPage } from "@/lib/integrations/hotels/hotelbeds-content-sync";
import { buildHotelbedsCertificationPlan } from "@/lib/integrations/hotels/hotelbeds-certification-plan";
import {
  buildHotelbedsCertificationStay,
  summarizeHotelbedsAvailabilityProbe,
} from "@/lib/integrations/hotels/hotelbeds-certification-probe";
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

async function certificationPlan() {
  const ready = readiness();
  const cache = await cacheStatus();
  return {
    readiness: ready,
    cache,
    plan: buildHotelbedsCertificationPlan({
      apiKey: ready.apiKey,
      secret: ready.secret,
      certificate: ready.certificate,
      privateKey: ready.privateKey,
      contentConfigured: ready.contentConfigured,
      cachedHotels: cache.cachedHotels,
    }),
  };
}

async function runAvailabilityProbe() {
  const ready = readiness();
  if (!ready.apiKey || !ready.secret || !ready.certificate || !ready.privateKey) {
    return NextResponse.json({ error: "Hotelbeds availability probe requires API credentials and mTLS material." }, { status: 409 });
  }

  const { data: cachedHotels, error } = await supabaseAdmin
    .from("hotelbeds_hotel_content")
    .select("hotel_code,name,destination_name")
    .order("hotel_code", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: `Unable to load cached Hotelbeds hotels: ${error.message}` }, { status: 500 });
  }
  if (!cachedHotels?.length) {
    return NextResponse.json({ error: "No cached Hotelbeds hotels are available for the certification probe." }, { status: 409 });
  }

  const codes = cachedHotels.map((hotel) => Number(hotel.hotel_code)).filter((code) => Number.isInteger(code) && code > 0);
  if (!codes.length) {
    return NextResponse.json({ error: "Cached Hotelbeds hotel codes are invalid." }, { status: 409 });
  }

  const stay = buildHotelbedsCertificationStay();
  const adapter = new HotelbedsHotelAdapter();
  const result = await adapter.search({
    destination: codes.join(","),
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    guests: 2,
    adults: 2,
    rooms: 1,
    currency: "KES",
    provider: "hotelbeds",
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error.message,
      supplierRequestCount: 1,
      testedHotels: codes.length,
      request: { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 2, rooms: 1, currency: "KES" },
      supplierError: result.error,
    }, { status: 502 });
  }

  const summary = summarizeHotelbedsAvailabilityProbe(result.data.results);
  return NextResponse.json({
    ok: true,
    supplierRequestCount: 1,
    testedHotels: codes.length,
    request: { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 2, rooms: 1, currency: "KES" },
    ...summary,
  });
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await certificationPlan());
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

    if (action === "certification_plan") {
      return NextResponse.json(await certificationPlan());
    }

    if (action === "availability_probe") {
      return runAvailabilityProbe();
    }

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
