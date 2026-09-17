import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchHotelbedsHotelContentPage } from "./hotelbeds-content";

type JsonRecord = Record<string, unknown>;

export type NormalizedHotelbedsContentRow = {
  hotel_code: number;
  language: string;
  name: string | null;
  destination_code: string | null;
  destination_name: string | null;
  country_code: string | null;
  category_code: string | null;
  category_name: string | null;
  address: JsonRecord;
  coordinates: JsonRecord;
  descriptions: unknown[];
  images: unknown[];
  facilities: unknown[];
  rooms: unknown[];
  raw: JsonRecord;
  supplier_last_update: string | null;
  synced_at: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractHotelbedsContentPage(payload: JsonRecord) {
  const nested = isRecord(payload.hotels) ? payload.hotels : null;
  const hotels = Array.isArray(payload.hotels)
    ? records(payload.hotels)
    : records(nested?.hotels);

  const total = numberOrNull(payload.total ?? nested?.total);
  const from = numberOrNull(payload.from ?? nested?.from);
  const to = numberOrNull(payload.to ?? nested?.to);

  return { hotels, total, from, to };
}

export function normalizeHotelbedsContentHotel(
  hotel: JsonRecord,
  language = "ENG",
  syncedAt = new Date().toISOString()
): NormalizedHotelbedsContentRow | null {
  const hotelCode = Number(hotel.code);
  if (!Number.isInteger(hotelCode) || hotelCode <= 0) return null;

  const address = isRecord(hotel.address) ? hotel.address : {};
  const coordinates = {
    latitude: numberOrNull(hotel.latitude),
    longitude: numberOrNull(hotel.longitude),
  };

  const descriptionValue = hotel.description;
  const descriptions = Array.isArray(descriptionValue)
    ? descriptionValue
    : descriptionValue === undefined || descriptionValue === null
      ? []
      : [descriptionValue];

  return {
    hotel_code: hotelCode,
    language: language.toUpperCase(),
    name: text(hotel.name),
    destination_code: text(hotel.destinationCode),
    destination_name: text(hotel.destinationName),
    country_code: text(hotel.countryCode),
    category_code: text(hotel.categoryCode),
    category_name: text(hotel.categoryName),
    address,
    coordinates,
    descriptions,
    images: Array.isArray(hotel.images) ? hotel.images : [],
    facilities: Array.isArray(hotel.facilities) ? hotel.facilities : [],
    rooms: Array.isArray(hotel.rooms) ? hotel.rooms : [],
    raw: hotel,
    supplier_last_update: text(hotel.lastUpdate ?? hotel.lastUpdateTime ?? hotel.updateTime),
    synced_at: syncedAt,
  };
}

export async function syncOneHotelbedsContentPage() {
  const { data: existingState, error: stateError } = await supabaseAdmin
    .from("hotelbeds_content_sync_state")
    .select("sync_key,next_from,page_size,language,incremental_since,supplier_total,last_page_count,status,last_error,last_started_at,last_completed_at")
    .eq("sync_key", "hotel-content")
    .maybeSingle();

  if (stateError) throw new Error(`Unable to load Hotelbeds content sync state: ${stateError.message}`);

  const state = existingState || {
    sync_key: "hotel-content",
    next_from: 1,
    page_size: 1000,
    language: "ENG",
    incremental_since: null,
    supplier_total: null,
    last_page_count: 0,
    status: "idle",
    last_error: null,
    last_started_at: null,
    last_completed_at: null,
  };

  const from = Math.max(1, Number(state.next_from || 1));
  const pageSize = Math.min(1000, Math.max(1, Number(state.page_size || 1000)));
  const to = from + pageSize - 1;
  const language = String(state.language || "ENG").toUpperCase();
  const startedAt = new Date().toISOString();

  await supabaseAdmin
    .from("hotelbeds_content_sync_state")
    .upsert({
      sync_key: "hotel-content",
      next_from: from,
      page_size: pageSize,
      language,
      incremental_since: state.incremental_since || null,
      status: "running",
      last_error: null,
      last_started_at: startedAt,
    }, { onConflict: "sync_key" });

  try {
    const payload = await fetchHotelbedsHotelContentPage({
      from,
      to,
      language,
      lastUpdateTime: state.incremental_since || undefined,
    });
    const page = extractHotelbedsContentPage(payload);
    const syncedAt = new Date().toISOString();
    const rows = page.hotels
      .map((hotel) => normalizeHotelbedsContentHotel(hotel, language, syncedAt))
      .filter((row): row is NormalizedHotelbedsContentRow => Boolean(row));

    if (rows.length) {
      const { error: upsertError } = await supabaseAdmin
        .from("hotelbeds_hotel_content")
        .upsert(rows, { onConflict: "hotel_code" });
      if (upsertError) throw new Error(`Unable to store Hotelbeds hotel content: ${upsertError.message}`);
    }

    const supplierTotal = page.total ?? state.supplier_total ?? null;
    const consumedThrough = from + page.hotels.length - 1;
    const reachedEnd = page.hotels.length === 0
      || page.hotels.length < pageSize
      || (supplierTotal !== null && consumedThrough >= supplierTotal);
    const nextFrom = reachedEnd ? 1 : from + pageSize;

    const { error: updateError } = await supabaseAdmin
      .from("hotelbeds_content_sync_state")
      .upsert({
        sync_key: "hotel-content",
        next_from: nextFrom,
        page_size: pageSize,
        language,
        incremental_since: state.incremental_since || null,
        supplier_total: supplierTotal,
        last_page_count: rows.length,
        status: reachedEnd ? "completed" : "idle",
        last_error: null,
        last_started_at: startedAt,
        last_completed_at: reachedEnd ? syncedAt : state.last_completed_at || null,
      }, { onConflict: "sync_key" });
    if (updateError) throw new Error(`Unable to update Hotelbeds content sync state: ${updateError.message}`);

    return {
      ok: true as const,
      from,
      to,
      stored: rows.length,
      supplierTotal,
      nextFrom,
      completed: reachedEnd,
      language,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hotelbeds content sync failed.";
    await supabaseAdmin
      .from("hotelbeds_content_sync_state")
      .upsert({
        sync_key: "hotel-content",
        next_from: from,
        page_size: pageSize,
        language,
        incremental_since: state.incremental_since || null,
        status: "failed",
        last_error: message,
        last_started_at: startedAt,
      }, { onConflict: "sync_key" });
    throw error;
  }
}
