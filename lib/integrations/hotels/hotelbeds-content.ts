import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { gunzipSync } from "node:zlib";

export type HotelbedsContentEnvironment = "test" | "production";

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

export function hotelbedsContentEnvironment(): HotelbedsContentEnvironment {
  return (env("SAFARIPLUG_HOTEL_HOTELBEDS_ENV") || "test").toLowerCase() === "production" ? "production" : "test";
}

export function hotelbedsContentBaseUrl() {
  return hotelbedsContentEnvironment() === "production" ? "https://api.hotelbeds.com" : "https://api.test.hotelbeds.com";
}

export function hotelbedsContentSignature(apiKey: string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)) {
  return createHash("sha256").update(`${apiKey}${secret}${timestampSeconds}`).digest("hex");
}

function credentials() {
  return {
    apiKey: env("SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY"),
    secret: env("SAFARIPLUG_HOTEL_HOTELBEDS_SECRET"),
  };
}

export function hotelbedsContentConfigured() {
  const auth = credentials();
  return Boolean(auth.apiKey && auth.secret);
}

export function hotelbedsHotelContentUrl(from = 1, to = 1000, language = "ENG", lastUpdateTime?: string) {
  const safeFrom = Math.max(1, Math.floor(from));
  const safeTo = Math.min(safeFrom + 999, Math.max(safeFrom, Math.floor(to)));
  const url = new URL("/hotel-content-api/1.0/hotels", hotelbedsContentBaseUrl());
  url.searchParams.set("fields", "all");
  url.searchParams.set("language", language.toUpperCase());
  url.searchParams.set("from", String(safeFrom));
  url.searchParams.set("to", String(safeTo));
  if (lastUpdateTime?.trim()) url.searchParams.set("lastUpdateTime", lastUpdateTime.trim());
  return url;
}

async function contentGet<T>(url: URL): Promise<T> {
  const auth = credentials();
  if (!auth.apiKey || !auth.secret) throw new Error("Hotelbeds Content API credentials are not configured.");
  const signature = hotelbedsContentSignature(auth.apiKey, auth.secret);
  return new Promise<T>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Api-key": auth.apiKey,
        "X-Signature": signature,
      },
      timeout: 15000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const raw = Buffer.concat(chunks);
        let decoded = raw;
        if (String(response.headers["content-encoding"] || "").toLowerCase().includes("gzip")) {
          try { decoded = gunzipSync(raw); } catch (error) { reject(error); return; }
        }
        const text = decoded.toString("utf8");
        let parsed: unknown = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
        const status = response.statusCode || 500;
        if (status < 200 || status >= 300) {
          const candidate = parsed as { error?: { message?: string }; message?: string };
          reject(new Error(candidate.error?.message || candidate.message || `Hotelbeds Content API returned HTTP ${status}.`));
          return;
        }
        resolve(parsed as T);
      });
    });
    request.on("timeout", () => request.destroy(new Error("Hotelbeds Content API request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function fetchHotelbedsHotelContentPage(options: {
  from?: number;
  to?: number;
  language?: string;
  lastUpdateTime?: string;
} = {}) {
  const url = hotelbedsHotelContentUrl(options.from, options.to, options.language, options.lastUpdateTime);
  return contentGet<Record<string, unknown>>(url);
}

// Deliberately no browser/public route here. Static Content API data is intended for
// controlled batch ingestion into SafariPlug storage, not real-time page rendering.
