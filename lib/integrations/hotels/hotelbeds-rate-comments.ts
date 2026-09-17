import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { gunzipSync } from "node:zlib";
import { hotelbedsContentBaseUrl } from "./hotelbeds-content";

type JsonRecord = Record<string, unknown>;

export type HotelbedsResolvedRateComment = {
  description: string;
  dateStart: string | null;
  dateEnd: string | null;
};

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function descriptionText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value)) {
    const content = value.content;
    if (typeof content === "string" && content.trim()) return content.trim();
  }
  return null;
}

function dateText(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function appliesToCheckIn(comment: HotelbedsResolvedRateComment, checkIn: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return true;
  if (comment.dateStart && checkIn < comment.dateStart) return false;
  if (comment.dateEnd && checkIn > comment.dateEnd) return false;
  return true;
}

export function extractHotelbedsRateComments(payload: unknown, checkIn: string): HotelbedsResolvedRateComment[] {
  const found: HotelbedsResolvedRateComment[] = [];
  const seen = new Set<string>();

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!isRecord(value)) return;

    const description = descriptionText(value.description);
    if (description) {
      const comment = {
        description,
        dateStart: dateText(value.dateStart ?? value.startDate),
        dateEnd: dateText(value.dateEnd ?? value.endDate),
      };
      if (appliesToCheckIn(comment, checkIn)) {
        const key = `${comment.dateStart || ""}|${comment.dateEnd || ""}|${comment.description}`;
        if (!seen.has(key)) {
          seen.add(key);
          found.push(comment);
        }
      }
    }

    Object.values(value).forEach(walk);
  }

  walk(payload);
  return found;
}

export function hotelbedsRateCommentsUrl(rateCommentsId: string, language = "ENG") {
  const code = rateCommentsId.trim();
  if (!code) throw new Error("Hotelbeds rateCommentsId is required.");
  const url = new URL("/hotel-content-api/1.0/types/ratecomments", hotelbedsContentBaseUrl());
  url.searchParams.set("code", code);
  url.searchParams.set("fields", "all");
  url.searchParams.set("language", language.toUpperCase());
  url.searchParams.set("from", "1");
  url.searchParams.set("to", "100");
  url.searchParams.set("useSecondaryLanguage", "true");
  return url;
}

function signature(apiKey: string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)) {
  return createHash("sha256").update(`${apiKey}${secret}${timestampSeconds}`).digest("hex");
}

async function getJson(url: URL): Promise<unknown> {
  const apiKey = env("SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY");
  const secret = env("SAFARIPLUG_HOTEL_HOTELBEDS_SECRET");
  if (!apiKey || !secret) throw new Error("Hotelbeds Content API credentials are not configured.");

  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Api-key": apiKey,
        "X-Signature": signature(apiKey, secret),
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
          const candidate = isRecord(parsed) ? parsed : {};
          const nestedError = isRecord(candidate.error) ? candidate.error : {};
          const message = typeof nestedError.message === "string"
            ? nestedError.message
            : typeof candidate.message === "string"
              ? candidate.message
              : `Hotelbeds Rate Comments API returned HTTP ${status}.`;
          reject(new Error(message));
          return;
        }
        resolve(parsed);
      });
    });
    request.on("timeout", () => request.destroy(new Error("Hotelbeds Rate Comments request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function resolveHotelbedsRateComments(options: {
  rateCommentsId: string;
  checkIn: string;
  language?: string;
}) {
  const payload = await getJson(hotelbedsRateCommentsUrl(options.rateCommentsId, options.language));
  const comments = extractHotelbedsRateComments(payload, options.checkIn);
  return {
    rateCommentsId: options.rateCommentsId,
    comments,
    notices: comments.map((comment) => comment.description),
  };
}
