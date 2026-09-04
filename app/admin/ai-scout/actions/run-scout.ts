"use server";

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import { revalidatePath } from "next/cache";

type DiscoveredEvent = {
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

type DiscoveryResponse = { events: DiscoveredEvent[] };

type DiscoveryPass = {
  name: string;
  focus: string;
};

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceUrl(value: unknown): string | null {
  if (!isValidHttpUrl(value)) return null;
  const url = value.trim().replace(/[)\],.]+$/, "");
  const lower = url.toLowerCase();
  if (
    lower.startsWith("http://localhost") ||
    lower.startsWith("https://localhost") ||
    lower.includes("example.com") ||
    lower.includes("/admin/ai-scout") ||
    lower.includes("/admin/ai%20scout")
  ) return null;
  return url;
}

function normalizeImageUrl(value: unknown): string | null {
  const url = normalizeSourceUrl(value);
  if (!url) return null;
  return url;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds = "00"] = match;
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeConfidence(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentity(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVenueIdentity(value: unknown): string {
  return normalizeIdentity(value)
    .replace(/\b(the|venue|grounds|centre|center)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericPlaceholderTitle(title: string): boolean {
  const normalized = normalizeIdentity(title);
  const blocked = [
    "music and nightlife experience",
    "mombasa live music and nightlife experience",
    "mombasa live music and dj night",
    "mombasa afrobeat and amapiano night",
    "live music and nightlife experience",
    "nightlife experience",
    "music and nightlife experience",
  ];
  return blocked.includes(normalized);
}

function isInvalidSourceName(sourceName: string): boolean {
  const normalized = normalizeIdentity(sourceName);
  return (
    normalized.includes("safariplug ai scout") ||
    normalized === "test scout" ||
    normalized === "ai scout" ||
    normalized === "safariplug"
  );
}

function isGenericSourceUrl(sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();

    const knownListingRoots = new Set([
      "whats-on-mombasa.com",
      "ticketyetu.com",
      "eventbrite.com",
      "events.com",
    ]);

    if (knownListingRoots.has(host) && (path === "" || path === "/events")) return true;
    if (host === "whats-on-mombasa.com" && path === "") return true;
    return false;
  } catch {
    return true;
  }
}

function isWeakEventEvidence(event: DiscoveredEvent): boolean {
  const sourceUrl = normalizeSourceUrl(event.source_url);
  if (!sourceUrl) return true;

  if (isGenericSourceUrl(sourceUrl)) return true;

  const title = normalizeIdentity(event.title);
  const description = normalizeIdentity(event.description);
  const venue = normalizeIdentity(event.venue_name);

  if (!venue) return true;

  // A source should contain meaningful event identity somewhere in its URL when
  // it is not an official dedicated event site. This catches generic calendar
  // roots while still allowing dedicated official event domains such as
  // fallyipupalive.com/.
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.toLowerCase();
    const dedicatedEventHost =
      path === "" &&
      (host.includes("fallyipupa") || host.includes("wimbi") || host.includes("event"));

    if (!dedicatedEventHost && path === "") {
      const searchable = `${host} ${title} ${description}`;
      const titleTokens = title.split(" ").filter((token) => token.length >= 5).slice(0, 4);
      const tokenMatches = titleTokens.filter((token) => searchable.includes(token)).length;
      if (tokenMatches < Math.min(2, titleTokens.length)) return true;
    }
  } catch {
    return true;
  }

  return false;
}

function isValidEvent(event: DiscoveredEvent): boolean {
  const title = normalizeText(event.title);
  const description = normalizeText(event.description);
  const sourceName = normalizeText(event.source_name);
  const sourceUrl = normalizeSourceUrl(event.source_url);
  const startAt = normalizeDate(event.start_at);
  const confidence = normalizeConfidence(event.confidence_score);

  if (!startAt || new Date(startAt).getTime() <= Date.now()) {
    console.warn("Skipping event with missing/expired start date:", title, startAt);
    return false;
  }
  if (!title || !description || !sourceUrl) return false;
  if (isInvalidSourceName(sourceName)) return false;
  if (isGenericPlaceholderTitle(title)) return false;
  if (confidence < 60) return false;
  if (isWeakEventEvidence(event)) {
    console.warn("Skipping event with weak/generic source evidence:", title, sourceUrl);
    return false;
  }
  return true;
}

async function fetchEventImage(sourceUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const candidates: string[] = [];
    const add = (value: unknown) => {
      if (typeof value === "string" && value.trim()) candidates.push(value.trim());
    };

    const metaPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const pattern of metaPatterns) {
      const match = html.match(pattern);
      if (match?.[1]) add(match[1]);
    }

    for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi)) {
      if (match[1]) add(match[1]);
    }

    for (const raw of candidates) {
      try {
        const imageUrl = new URL(raw, sourceUrl).toString();
        const lower = imageUrl.toLowerCase();
        if (["logo", "icon", "avatar", "favicon", "placeholder", "sprite"].some((word) => lower.includes(word))) continue;
        if (lower.startsWith("http://") || lower.startsWith("https://")) return imageUrl;
      } catch {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.warn("IMAGE FETCH ERROR:", sourceUrl, error);
    return null;
  }
}

async function findExistingEvent(title: string, sourceUrl: string, startAt: string | null, venueName: string, city: string) {
  const normalizedTitle = normalizeIdentity(title);
  const normalizedSource = sourceUrl.toLowerCase();
  const normalizedVenue = normalizeVenueIdentity(venueName);
  const normalizedCity = normalizeIdentity(city);
  const startDate = startAt ? String(startAt).slice(0, 10) : "";

  const { data, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("id,title,source_url,start_at,venue_name,city")
    .limit(500);

  if (error) {
    console.error("DUPLICATE CHECK ERROR:", error);
    return null;
  }

  return (data || []).find((existing) => {
    const existingTitle = normalizeIdentity(existing.title);
    const existingSource = String(existing.source_url || "").trim().toLowerCase();
    const existingVenue = normalizeVenueIdentity(existing.venue_name);
    const existingCity = normalizeIdentity(existing.city);
    const existingDate = String(existing.start_at || "").slice(0, 10);

    const sameSource = existingSource === normalizedSource;
    const sameTitle = Boolean(normalizedTitle && existingTitle && normalizedTitle === existingTitle);
    const sameDate = Boolean(startDate && existingDate && startDate === existingDate);
    const sameVenue = Boolean(normalizedVenue && existingVenue && normalizedVenue === existingVenue);
    const sameCity = Boolean(normalizedCity && existingCity && normalizedCity === existingCity);

    return (
      (sameTitle && sameDate && sameCity) ||
      (sameTitle && sameDate && sameVenue) ||
      (sameSource && sameTitle && sameDate)
    );
  }) || null;
}

const SYSTEM_PROMPT = [
  "You are SafariPlug AI Scout.",
  "Discover only real upcoming events or experiences supported by live web evidence.",
  "Never invent an event, source, image, venue, date, time, or price.",
  "Unknown information must be null. Unknown price is not free.",
  "Every returned event must have a real external HTTP/HTTPS source URL and source name.",
  "Never use SafariPlug, SafariPlug AI Scout, localhost, example.com, or SafariPlug admin URLs as sources.",
  "Do not use a generic homepage, category index, or site-wide event listing as the source URL when a direct event page exists.",
  "If only a generic listing page is available and it does not clearly provide the complete event evidence, do not return the event.",
  "Return only JSON with an events array.",
].join(" ");

function buildPassPrompt(location: string, category: string, pass: DiscoveryPass): string {
  const todayKenya = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
  return [
    `Today in Kenya is ${todayKenya}. Find real upcoming ${category} events or experiences in ${location}, Kenya.`,
    "",
    `DISCOVERY PASS: ${pass.name}`,
    pass.focus,
    "",
    "Search the live web thoroughly. Do not stop after one result.",
    "Prioritize concrete event pages, official organizer/venue pages, official public social posts, legitimate ticketing platforms, reputable local event calendars, and local publications.",
    "For recurring weekly/monthly events, return the next upcoming occurrence only when the source clearly establishes the recurrence and the occurrence date can be resolved from the source.",
    "Do not return an event with a TBA, tentative, missing, or unverifiable upcoming date.",
    "Cross-check promising events when practical, but one strong official source is acceptable.",
    "For every event collect title, useful description, venue, address if available, city, actual upcoming start/end datetime, supported price/currency, source URL/name, image URL if directly established, and confidence.",
    "The source_url must point to the specific event, organizer announcement, venue event listing, or other page containing evidence for THIS event. Do not use a generic homepage or generic calendar root when a specific page exists.",
    "If you can only find a generic listing page, use it only when the page itself clearly identifies the exact event, date, and venue; otherwise omit the event.",
    "Return at most 8 distinct events from this pass.",
    "Return ONLY valid JSON in exactly this shape:",
    '{"events":[{"title":"string","description":"string","venue_name":"string or null","venue_address":"string or null","city":"string","start_at":"ISO datetime string or null","end_at":"ISO datetime string or null","price":"number or null","currency":"string or null","image_url":"string or null","source_url":"string","source_name":"string","confidence_score":0}]}',
  ].join("\n");
}

async function runDiscoveryPass(openai: OpenAI, location: string, category: string, pass: DiscoveryPass): Promise<DiscoveredEvent[]> {
  console.log(`SCOUT PASS ${pass.name}: starting`);
  try {
    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPassPrompt(location, category, pass) },
      ],
    });

    const text = response.output_text?.trim();
    if (!text) {
      console.warn(`SCOUT PASS ${pass.name}: empty response`);
      return [];
    }

    try {
      const parsed = JSON.parse(text) as DiscoveryResponse;
      if (!parsed || !Array.isArray(parsed.events)) {
        console.warn(`SCOUT PASS ${pass.name}: invalid events array`);
        return [];
      }
      console.log(`SCOUT PASS ${pass.name}: ${parsed.events.length} candidate(s)`);
      return parsed.events;
    } catch (error) {
      console.warn(`SCOUT PASS ${pass.name}: invalid JSON`, error);
      console.warn(text.slice(0, 2000));
      return [];
    }
  } catch (error) {
    console.error(`SCOUT PASS ${pass.name} ERROR:`, error);
    return [];
  }
}

function dedupeCandidates(events: DiscoveredEvent[]): DiscoveredEvent[] {
  const result: DiscoveredEvent[] = [];
  const seenTitles = new Set<string>();
  const seenEventKeys = new Set<string>();

  for (const event of events) {
    const title = normalizeIdentity(event.title);
    const date = normalizeDate(event.start_at)?.slice(0, 10) || "";
    const venue = normalizeVenueIdentity(event.venue_name);
    const city = normalizeIdentity(event.city);
    const source = normalizeSourceUrl(event.source_url)?.toLowerCase() || "";

    const eventKey = `${date}|${city}|${venue}|${title}`;
    const titleDateCityKey = `${date}|${city}|${title}`;
    const sourceTitleDateKey = `${source}|${date}|${title}`;

    if (titleDateCityKey !== "||" && seenTitles.has(titleDateCityKey)) continue;
    if (eventKey !== "|||" && seenEventKeys.has(eventKey)) continue;
    if (sourceTitleDateKey !== "||" && seenTitles.has(sourceTitleDateKey)) continue;

    if (titleDateCityKey !== "||") seenTitles.add(titleDateCityKey);
    if (eventKey !== "|||") seenEventKeys.add(eventKey);
    if (sourceTitleDateKey !== "||") seenTitles.add(sourceTitleDateKey);
    result.push(event);
  }
  return result;
}

export async function runAIScout(formData: FormData) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const location = String(formData.get("location") || "").trim();
  const submittedCategory = String(formData.get("category") || "").trim();
  const category = EVENT_CATEGORIES.find((value) => value === submittedCategory);

  if (!location || !submittedCategory) throw new Error("Missing location or category");
  if (!category) throw new Error(`Unsupported Scout category "${submittedCategory}". Use a canonical EVENT_CATEGORIES value.`);

  const { data: run, error: runError } = await supabaseAdmin
    .from("ai_scout_runs")
    .insert({ location, category, status: "running", events_found: 0 })
    .select()
    .single();

  if (runError || !run) {
    console.error("RUN ERROR:", runError);
    throw new Error("Could not start AI Scout");
  }

  try {
    const passes: DiscoveryPass[] = [
      {
        name: "GENERAL",
        focus: `Search broadly for named upcoming ${category} events, festivals, concerts, shows, experiences, and public event listings in ${location}. Cover the next several weeks rather than only today.`,
      },
      {
        name: "VENUES",
        focus: `Search venue-by-venue. For ${location}, inspect clubs, lounges, beach clubs, hotels, restaurants, resorts, concert venues, cultural spaces, entertainment venues, and recurring event series. For Music & Nightlife, explicitly investigate live music, DJ nights, Afrobeat, Amapiano, reggae, R&B, bands, parties, beach parties, rooftop events, and concerts.`,
      },
      {
        name: "CALENDARS",
        focus: `Search ticketing and local discovery sources plus organizer/promoter pages, public social accounts, tourism/event calendars, local publications, and reputable event directories. Look for events that broad search may miss, including smaller local nightlife listings and upcoming ticketed events.`,
      },
    ];

    const passResults = await Promise.all(
      passes.map((pass) => runDiscoveryPass(openai, location, category, pass))
    );

    const rawCandidateCount = passResults.reduce((sum, events) => sum + events.length, 0);
    const candidateEvents = dedupeCandidates(passResults.flat());
    console.log(`SCOUT RAW CANDIDATES: ${rawCandidateCount}`);
    console.log(`SCOUT MERGED CANDIDATES: ${candidateEvents.length}`);

    let insertedCount = 0;
    let duplicateCount = 0;
    let blockedCount = 0;

    for (const event of candidateEvents) {
      if (insertedCount >= 5) break;

      console.log("CHECKING EVENT:", event.title, event.confidence_score, event.source_name, event.source_url);
      if (!isValidEvent(event)) {
        blockedCount++;
        console.log("BLOCKED:", event.title);
        continue;
      }

      const title = normalizeText(event.title);
      const description = normalizeText(event.description);
      const sourceUrl = normalizeSourceUrl(event.source_url);
      const sourceName = normalizeText(event.source_name);
      const venueName = normalizeText(event.venue_name);
      const venueAddress = normalizeText(event.venue_address);
      const city = normalizeText(event.city) || location;
      const confidence = normalizeConfidence(event.confidence_score);
      const startAt = normalizeDate(event.start_at);
      const endAt = normalizeDate(event.end_at);

      if (!sourceUrl || !startAt) continue;

      const duplicate = await findExistingEvent(title, sourceUrl, startAt, venueName, city);
      if (duplicate) {
        duplicateCount++;
        console.log("Skipping duplicate event:", title);
        continue;
      }

      const price = normalizePrice(event.price);
      let imageUrl = normalizeImageUrl(event.image_url);
      if (!imageUrl) imageUrl = await fetchEventImage(sourceUrl);
      const currency = price !== null ? normalizeText(event.currency) || "KES" : null;

      const { error: eventError } = await supabaseAdmin
        .from("ai_discovered_events")
        .insert({
          title,
          description,
          category,
          city,
          venue_name: venueName || null,
          venue_address: venueAddress || null,
          start_at: startAt,
          end_at: endAt,
          price,
          currency,
          image_url: imageUrl,
          source_url: sourceUrl,
          source_name: sourceName || null,
          confidence_score: confidence,
          status: "pending_review",
        });

      if (eventError) {
        console.error("EVENT INSERT ERROR:", eventError);
        continue;
      }

      insertedCount++;
      console.log("EVENT INSERTED:", title, "| IMAGE:", imageUrl || "NULL");
    }

    const { error: updateError } = await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        events_found: insertedCount,
        status: "completed",
        completed_at: new Date().toISOString(),
        notes: `Completed successfully. ${passes.length} discovery passes searched. Raw candidates ${rawCandidateCount}; merged candidates ${candidateEvents.length}; blocked ${blockedCount}; duplicates ${duplicateCount}; inserted ${insertedCount}.`,
      })
      .eq("id", run.id);

    if (updateError) {
      console.error("RUN UPDATE ERROR:", updateError);
      throw new Error("Could not complete AI Scout run");
    }

    revalidatePath("/admin/ai-events");
    revalidatePath("/admin/ai-scout");
  } catch (error) {
    console.error("AI SCOUT ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const safeErrorMessage = errorMessage.length > 1000 ? `${errorMessage.slice(0, 1000)}...` : errorMessage;

    const { error: failureUpdateError } = await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        notes: `AI Scout failed: ${safeErrorMessage}`,
      })
      .eq("id", run.id);

    if (failureUpdateError) console.error("FAILED RUN UPDATE ERROR:", failureUpdateError);
    throw error;
  }
}
