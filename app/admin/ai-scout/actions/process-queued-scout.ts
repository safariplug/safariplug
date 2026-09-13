import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

export type QueuedScoutJob = {
  id: string;
  location: string;
  category: string;
  attempt_count: number;
  max_attempts: number;
};

type Candidate = {
  title: string;
  description: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string;
  start_at: string | null;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  source_url: string;
  source_name: string;
  confidence_score: number;
};

type DiscoveryResponse = { events: Candidate[] };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function identity(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim().replace(/[)\],.]+$/, ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const lower = url.toString().toLowerCase();
    if (lower.includes("example.com") || lower.includes("safariplug.com/admin")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (!/Z$/i.test(raw) && !/[+-]\d{2}:?\d{2}$/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function confidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function price(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulMatch(haystack: string, value: string, minimum: number) {
  const tokens = identity(value).split(" ").filter((token) => token.length >= 4);
  if (!tokens.length) return false;
  return tokens.filter((token) => haystack.includes(token)).length >= Math.min(minimum, tokens.length);
}

function dateEvidence(startAt: string) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return [];
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const shortMonth = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = date.toLocaleString("en-US", { day: "numeric", timeZone: "UTC" });
  const year = date.toLocaleString("en-US", { year: "numeric", timeZone: "UTC" });
  return [`${month} ${day} ${year}`, `${day} ${month} ${year}`, `${shortMonth} ${day} ${year}`, `${day} ${shortMonth} ${year}`, `${month} ${day}`, `${day} ${month}`].map(identity);
}

async function verifySource(event: Candidate) {
  const sourceUrl = httpUrl(event.source_url);
  const startAt = isoDate(event.start_at);
  if (!sourceUrl || !startAt) return false;

  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 SafariPlug Scout", Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) return false;

    const page = identity(stripHtml(await response.text())).slice(0, 250000);
    if (!page) return false;
    if (!meaningfulMatch(page, event.title, 2)) return false;
    if (!dateEvidence(startAt).some((variant) => variant && page.includes(variant))) return false;
    if (text(event.venue_name) && !meaningfulMatch(page, text(event.venue_name), 1)) return false;
    return true;
  } catch {
    return false;
  }
}

async function existingKeys() {
  const { data } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("title,city,start_at,source_url")
    .limit(1000);

  const keys = new Set<string>();
  for (const row of data || []) {
    const title = identity(row.title);
    const city = identity(row.city);
    const date = String(row.start_at || "").slice(0, 10);
    const source = String(row.source_url || "").trim().toLowerCase();
    if (title && city && date) keys.add(`${title}|${city}|${date}`);
    if (source && title && date) keys.add(`${source}|${title}|${date}`);
  }
  return keys;
}

function prompt(location: string, category: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  return [
    `Today is ${today} UTC. Discover real upcoming ${category} events or experiences specifically in ${location}, Africa.`,
    `The requested destination ${location} is authoritative. Do not substitute Nairobi, Kenya, or another city.`,
    "Perform one comprehensive search covering official venue/organizer pages, legitimate ticketing platforms, public organizer social posts, local event calendars, tourism sources, and reputable local publications.",
    "For Music & Nightlife include concerts, DJ nights, live music, Afrobeat, Amapiano, reggae, R&B, rooftop events, parties, beach events, clubs, lounges, hotels, and recurring venue programming when the next occurrence is verifiable.",
    "Return only genuinely upcoming events with a specific verifiable date, venue, and direct source URL.",
    "Never invent an event, date, venue, price, source, country, currency, or image.",
    "Unknown price/currency/image must be null. Unknown price never means free.",
    "Every datetime must include an explicit UTC offset or Z appropriate to the event location.",
    "Prefer direct event pages over generic homepages or calendar roots.",
    "Return at most 10 distinct candidates.",
    "Return ONLY valid JSON exactly in this shape:",
    '{"events":[{"title":"string","description":"string","venue_name":"string or null","venue_address":"string or null","city":"string","start_at":"ISO datetime with offset or Z","end_at":"ISO datetime with offset or Z or null","price":"number or null","currency":"ISO currency or null","image_url":"string or null","source_url":"https URL","source_name":"string","confidence_score":0}]}',
  ].join("\n");
}

export async function processQueuedScout(job: QueuedScoutJob) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  if (!EVENT_CATEGORIES.includes(job.category as (typeof EVENT_CATEGORIES)[number])) {
    throw new Error(`Unsupported Scout category: ${job.category}`);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const started = Date.now();
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: "You are SafariPlug AI Scout, an Africa-wide discovery intelligence engine. Accuracy and verifiable live-web evidence are more important than volume. Return JSON only.",
      },
      { role: "user", content: prompt(job.location, job.category) },
    ],
  });

  const raw = response.output_text?.trim();
  if (!raw) throw new Error("AI Scout returned empty model output");

  let parsed: DiscoveryResponse;
  try {
    parsed = JSON.parse(raw) as DiscoveryResponse;
  } catch {
    throw new Error("AI Scout returned invalid JSON");
  }

  if (!parsed || !Array.isArray(parsed.events)) throw new Error("AI Scout returned an invalid response shape");

  const known = await existingKeys();
  const seen = new Set<string>();
  let inserted = 0;
  let blocked = 0;
  let duplicates = 0;
  let sourceBlocked = 0;

  for (const event of parsed.events) {
    if (inserted >= 5) break;

    const title = text(event.title);
    const description = text(event.description);
    const venueName = text(event.venue_name);
    const venueAddress = text(event.venue_address);
    const city = text(event.city) || job.location;
    const sourceUrl = httpUrl(event.source_url);
    const sourceName = text(event.source_name);
    const startAt = isoDate(event.start_at);
    const endAt = isoDate(event.end_at);
    const score = confidence(event.confidence_score);

    if (!title || !description || !venueName || !sourceUrl || !sourceName || !startAt || score < 60 || new Date(startAt).getTime() <= Date.now()) {
      blocked++;
      continue;
    }

    const date = startAt.slice(0, 10);
    const key = `${identity(title)}|${identity(city)}|${date}`;
    const sourceKey = `${sourceUrl.toLowerCase()}|${identity(title)}|${date}`;
    if (seen.has(key) || known.has(key) || known.has(sourceKey)) {
      duplicates++;
      continue;
    }

    if (!(await verifySource(event))) {
      sourceBlocked++;
      continue;
    }

    const amount = price(event.price);
    const currency = amount !== null ? text(event.currency).toUpperCase() || null : null;
    const imageUrl = httpUrl(event.image_url);

    const { error } = await supabaseAdmin.from("ai_discovered_events").insert({
      title,
      description,
      category: job.category,
      city,
      venue_name: venueName,
      venue_address: venueAddress || null,
      start_at: startAt,
      end_at: endAt,
      price: amount,
      currency,
      image_url: imageUrl,
      source_url: sourceUrl,
      source_name: sourceName,
      confidence_score: score,
      status: "pending_review",
    });

    if (error) {
      blocked++;
      continue;
    }

    seen.add(key);
    known.add(key);
    known.add(sourceKey);
    inserted++;
  }

  return {
    inserted,
    candidates: parsed.events.length,
    blocked,
    duplicates,
    sourceBlocked,
    durationMs: Date.now() - started,
  };
}
