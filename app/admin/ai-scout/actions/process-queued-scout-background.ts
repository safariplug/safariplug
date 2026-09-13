import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import type { QueuedScoutJob } from "./process-queued-scout";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const MAX_CANDIDATES = 12;
const MAX_INSERTS = 8;
const FETCH_CONCURRENCY = 4;
const MAX_OUTPUT_TOKENS = 6000;

const TRUSTED_EVENT_HOSTS = [
  "quicket.co.ug",
  "quicket.co.ke",
  "mookh.com",
  "hustlesasa.shop",
  "madfun.com",
  "gig.co.ke",
  "ticketyetu.com",
  "eventbrite.com",
  "allevents.in",
  "ticketmaster.com",
];

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
type VerificationTier = "strong" | "trusted_platform" | "social_public" | "manual_review" | "reject";
type VerificationResult = { tier: VerificationTier; reason: string };

type PreparedCandidate = {
  event: Candidate;
  title: string;
  description: string;
  venueName: string;
  city: string;
  sourceUrl: string | null;
  sourceName: string;
  startAt: string | null;
  score: number;
  reason: string;
};

export type BackgroundScoutResult = {
  inserted: number;
  candidates: number;
  blocked: number;
  duplicates: number;
  sourceBlocked: number;
  verificationTiers: Record<string, number>;
  blockedReasons: Record<string, number>;
  durationMs: number;
};

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
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname.toLowerCase() === "example.com") return null;
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
  return [
    `${month} ${day} ${year}`,
    `${day} ${month} ${year}`,
    `${shortMonth} ${day} ${year}`,
    `${day} ${shortMonth} ${year}`,
    `${month} ${day}`,
    `${day} ${month}`,
  ].map(identity);
}

function hostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function trustedPlatform(sourceUrl: string) {
  const host = hostname(sourceUrl);
  return TRUSTED_EVENT_HOSTS.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
}

function publicSocialPlatform(sourceUrl: string) {
  const host = hostname(sourceUrl);
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com") return "facebook";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) return "x";
  return null;
}

function safariPlugConfidence(verification: VerificationResult, modelScore: number) {
  const base =
    verification.tier === "strong" ? 95 :
    verification.tier === "trusted_platform" ? 88 :
    verification.tier === "social_public" ? 76 :
    verification.tier === "manual_review" ? 68 :
    0;
  if (!base) return 0;
  const boundedModel = Math.max(0, Math.min(100, modelScore));
  return Math.max(base - 5, Math.min(99, Math.round(base * 0.85 + boundedModel * 0.15)));
}

function sameDestination(candidateCity: string, requestedLocation: string) {
  const city = identity(candidateCity);
  const requested = identity(requestedLocation);
  return Boolean(city && requested && (city === requested || city.includes(requested) || requested.includes(city)));
}

function htmlEntityDecode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractMetaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return htmlEntityDecode(match[1].trim());
    }
  }
  return null;
}

function absoluteImageUrl(value: string | null, sourceUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, sourceUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function recoverSourceImage(sourceUrl: string, existingImage: string | null) {
  const direct = httpUrl(existingImage);
  if (direct) return direct;
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 SafariPlug Scout", Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const metaImage = extractMetaContent(html, ["og:image:secure_url", "og:image", "twitter:image:src", "twitter:image"]);
    const resolvedMeta = absoluteImageUrl(metaImage, response.url || sourceUrl);
    if (resolvedMeta) return resolvedMeta;
    const imageSrc = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i)?.[1]
      || null;
    return absoluteImageUrl(imageSrc, response.url || sourceUrl);
  } catch {
    return null;
  }
}

async function verifySource(event: Candidate): Promise<VerificationResult> {
  const sourceUrl = httpUrl(event.source_url);
  const startAt = isoDate(event.start_at);
  if (!sourceUrl || !startAt) return { tier: "reject", reason: "missing_source_or_datetime" };
  const trusted = trustedPlatform(sourceUrl);
  const social = publicSocialPlatform(sourceUrl);
  const score = confidence(event.confidence_score);

  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 SafariPlug Scout", Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      if (social) return { tier: "social_public", reason: `${social}_public_source_http_${response.status}` };
      if (trusted && score >= 70) return { tier: "trusted_platform", reason: `trusted_platform_http_${response.status}` };
      if (score >= 80) return { tier: "manual_review", reason: `source_http_${response.status}` };
      return { tier: "reject", reason: `source_http_${response.status}` };
    }

    const page = identity(stripHtml(await response.text())).slice(0, 200000);
    if (!page) {
      if (social) return { tier: "social_public", reason: `${social}_public_dynamic_page` };
      if (trusted && score >= 70) return { tier: "trusted_platform", reason: "trusted_platform_dynamic_page" };
      return score >= 80 ? { tier: "manual_review", reason: "empty_or_dynamic_page" } : { tier: "reject", reason: "empty_source_page" };
    }

    const titleMatch = meaningfulMatch(page, event.title, 2);
    const dateMatch = dateEvidence(startAt).some((variant) => variant && page.includes(variant));
    const venueMatch = !text(event.venue_name) || meaningfulMatch(page, text(event.venue_name), 1);
    if (titleMatch && dateMatch && venueMatch) return { tier: "strong", reason: "title_date_venue_match" };
    if (social && (titleMatch || dateMatch || venueMatch)) return { tier: "social_public", reason: `${social}_public_partial_match` };
    if (trusted && titleMatch && (dateMatch || venueMatch)) return { tier: "trusted_platform", reason: "trusted_platform_partial_match" };
    if (titleMatch || (dateMatch && venueMatch)) return { tier: "manual_review", reason: "partial_source_match" };
    if (social) return { tier: "social_public", reason: `${social}_public_search_discovery` };
    if (trusted && score >= 80) return { tier: "manual_review", reason: "trusted_platform_low_page_evidence" };
    return { tier: "reject", reason: "source_evidence_mismatch" };
  } catch {
    if (social) return { tier: "social_public", reason: `${social}_public_fetch_blocked` };
    if (trusted && score >= 70) return { tier: "trusted_platform", reason: "trusted_platform_fetch_blocked" };
    if (score >= 80) return { tier: "manual_review", reason: "source_fetch_blocked" };
    return { tier: "reject", reason: "source_fetch_failed" };
  }
}

async function mapBatched<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    const values = await Promise.all(batch.map((item, index) => fn(item, offset + index)));
    results.push(...values);
  }
  return results;
}

async function existingKeys() {
  const { data } = await supabaseAdmin.from("ai_discovered_events").select("title,city,start_at,source_url").limit(1000);
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
    `The requested destination ${location} is authoritative. Do not substitute another city.`,
    "Run TWO discovery passes before producing the final JSON:",
    "PASS 1 — Web: official venue and organizer pages, legitimate ticketing platforms, local event calendars, tourism sources, hotels, clubs, lounges, promoters, and reputable local publications.",
    "PASS 2 — Public social discovery: search publicly accessible/indexed Instagram, Facebook, TikTok and X/Twitter pages or posts from venues, promoters, artists, organizers and event brands. Prefer direct post/profile/event URLs when they are publicly discoverable.",
    "Public social sources are discovery evidence only. Do not invent content from private accounts, stories, closed groups, login-only pages, or posts you cannot actually find.",
    "For Music & Nightlife include concerts, DJ nights, live music, Afrobeat, Amapiano, reggae, R&B, rooftop events, parties, beach events, clubs, lounges, hotels, and recurring venue programming when the next occurrence is verifiable.",
    "Return genuinely upcoming candidates with a specific date, venue, destination, and the best direct source URL found.",
    "Where a social source reveals an event also listed on an official/ticketing page, prefer the stronger official/ticketing URL as source_url. Otherwise keep the public social URL so SafariPlug can send it for human review.",
    "When an official event poster, ticketing artwork, or public social event image is directly available, include that exact image URL in image_url. Do not use generic stock photography as image_url.",
    "Never invent an event, date, venue, price, source, country, currency, image, social handle, or social post.",
    "Unknown price/currency/image must be null. Every datetime must include an explicit UTC offset or Z appropriate to the event location.",
    "Set confidence_score to an integer from 0 to 100 based on the evidence you found, but SafariPlug will independently recalculate final confidence after verification.",
    `Return at most ${MAX_CANDIDATES} distinct candidates. Return ONLY valid JSON exactly in this shape:`,
    '{"events":[{"title":"string","description":"string","venue_name":"string or null","venue_address":"string or null","city":"string","start_at":"ISO datetime with offset or Z","end_at":"ISO datetime with offset or Z or null","price":"number or null","currency":"ISO currency or null","image_url":"string or null","source_url":"https URL","source_name":"string","confidence_score":85}]}',
  ].join("\n");
}

function openAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function startBackgroundScout(job: QueuedScoutJob) {
  if (!EVENT_CATEGORIES.includes(job.category as (typeof EVENT_CATEGORIES)[number])) {
    throw new Error(`Unsupported Scout category: ${job.category}`);
  }
  const response = await openAI().responses.create({
    model: OPENAI_MODEL,
    background: true,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: "You are SafariPlug AI Scout, an Africa-wide discovery intelligence engine. Find useful real candidates across the public web and publicly discoverable social sources, preserve source URLs, never fabricate details, and return JSON only.",
      },
      { role: "user", content: prompt(job.location, job.category) },
    ],
  });
  return { id: response.id, status: response.status };
}

export async function pollBackgroundScout(responseId: string) {
  const response = await openAI().responses.retrieve(responseId);
  return {
    id: response.id,
    status: response.status,
    outputText: response.output_text?.trim() || "",
    error: response.error?.message || null,
  };
}

function prepareCandidate(event: Candidate, job: QueuedScoutJob): PreparedCandidate {
  const title = text(event.title);
  const description = text(event.description);
  const venueName = text(event.venue_name);
  const city = text(event.city) || job.location;
  const sourceUrl = httpUrl(event.source_url);
  const sourceName = text(event.source_name);
  const startAt = isoDate(event.start_at);
  const score = confidence(event.confidence_score);
  let reason = "";
  if (!title) reason = "missing_title";
  else if (!description) reason = "missing_description";
  else if (!venueName) reason = "missing_venue";
  else if (!sourceUrl) reason = "missing_source_url";
  else if (!sourceName) reason = "missing_source_name";
  else if (!startAt) reason = "invalid_or_missing_datetime";
  else if (new Date(startAt).getTime() <= Date.now()) reason = "event_not_future";
  else if (!sameDestination(city, job.location)) reason = "destination_mismatch";
  return { event, title, description, venueName, city, sourceUrl, sourceName, startAt, score, reason };
}

export async function processBackgroundScoutOutput(job: QueuedScoutJob, raw: string): Promise<BackgroundScoutResult> {
  const started = Date.now();
  let parsed: DiscoveryResponse;
  try {
    parsed = JSON.parse(raw) as DiscoveryResponse;
  } catch {
    throw new Error("AI Scout returned invalid JSON");
  }
  if (!parsed || !Array.isArray(parsed.events)) throw new Error("AI Scout returned an invalid response shape");

  const known = await existingKeys();
  const seen = new Set<string>();
  const reasons: Record<string, number> = {};
  const tiers: Record<VerificationTier, number> = { strong: 0, trusted_platform: 0, social_public: 0, manual_review: 0, reject: 0 };
  let blocked = 0;
  let duplicates = 0;
  let sourceBlocked = 0;
  let inserted = 0;
  const countReason = (reason: string) => { reasons[reason] = (reasons[reason] || 0) + 1; };

  const prepared = parsed.events.slice(0, MAX_CANDIDATES).map((event) => prepareCandidate(event, job));
  const verifications = await mapBatched(prepared, FETCH_CONCURRENCY, async (item) => item.reason ? null : verifySource(item.event));

  const imageCandidates = prepared.map((item, index) => {
    const verification = verifications[index];
    const shouldRecover = !item.reason && verification && verification.tier !== "reject" && item.sourceUrl;
    return shouldRecover ? { sourceUrl: item.sourceUrl!, imageUrl: item.event.image_url } : null;
  });
  const recoveredImages = await mapBatched(imageCandidates, FETCH_CONCURRENCY, async (item) => {
    if (!item) return null;
    return recoverSourceImage(item.sourceUrl, item.imageUrl);
  });

  for (let index = 0; index < prepared.length && inserted < MAX_INSERTS; index++) {
    const item = prepared[index];
    if (item.reason) { blocked++; countReason(item.reason); continue; }

    const date = item.startAt!.slice(0, 10);
    const key = `${identity(item.title)}|${identity(item.city)}|${date}`;
    const sourceKey = `${item.sourceUrl!.toLowerCase()}|${identity(item.title)}|${date}`;
    if (seen.has(key) || known.has(key) || known.has(sourceKey)) {
      duplicates++;
      countReason("duplicate");
      continue;
    }

    const verification = verifications[index]!;
    tiers[verification.tier]++;
    countReason(verification.reason);
    if (verification.tier === "reject") { sourceBlocked++; continue; }

    const amount = price(item.event.price);
    const currency = amount !== null ? text(item.event.currency).toUpperCase() || null : null;
    const social = publicSocialPlatform(item.sourceUrl!);
    const finalConfidence = safariPlugConfidence(verification, item.score);
    const sourceType = social ? `social_${social}_${verification.tier}` : verification.tier;
    const recoveredImage = recoveredImages[index];
    const imageNote = recoveredImage
      ? "Official/source image recovered."
      : "No official/source image recovered; SafariPlug category fallback will be used.";

    const { error } = await supabaseAdmin.from("ai_discovered_events").insert({
      title: item.title,
      description: item.description,
      category: job.category,
      city: item.city,
      venue_name: item.venueName,
      venue_address: text(item.event.venue_address) || null,
      start_at: item.startAt,
      end_at: isoDate(item.event.end_at),
      price: amount,
      currency,
      image_url: recoveredImage,
      source_url: item.sourceUrl,
      source_name: item.sourceName,
      confidence_score: finalConfidence,
      status: "pending_review",
      review_status: "pending_review",
      review_notes: `AI Scout verification: ${verification.tier}. Evidence: ${verification.reason}. Source channel: ${social ? `public ${social}` : "web"}. SafariPlug confidence: ${finalConfidence}%. ${imageNote} Requested destination: ${job.location}.`,
      source_type: sourceType,
    });

    if (error) {
      if (error.code === "23505") {
        duplicates++;
        countReason("duplicate_database_guard");
        continue;
      }
      blocked++;
      countReason(`insert_error_${error.code || "unknown"}`);
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
    verificationTiers: tiers,
    blockedReasons: reasons,
    durationMs: Date.now() - started,
  };
}
