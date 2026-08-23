"use server";

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

type DiscoveryResponse = {
  events: DiscoveredEvent[];
};

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value.trim());

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function normalizeImageUrl(value: unknown): string | null {
  if (!isValidHttpUrl(value)) {
    return null;
  }

  const url = value.trim();

  if (
    url.startsWith("http://localhost") ||
    url.startsWith("https://localhost") ||
    url.includes("example.com")
  ) {
    return null;
  }

  return url;
}

function normalizeSourceUrl(value: unknown): string | null {
  if (!isValidHttpUrl(value)) {
    return null;
  }

  const url = value.trim().replace(/[)\],.]+$/, "");

  const lower = url.toLowerCase();

  if (
    lower.startsWith("http://localhost") ||
    lower.startsWith("https://localhost") ||
    lower.includes("example.com") ||
    lower.includes("/admin/ai-scout") ||
    lower.includes("/admin/ai%20scout") ||
    lower.includes("/admin/ai%20Scout")
  ) {
    return null;
  }

  return url;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();

  // Preserve explicit timezone information.
  // If the source gives Z or an explicit +/- offset,
  // normalize it to UTC.
  if (
    /Z$/i.test(trimmed) ||
    /[+-]\d{2}:?\d{2}$/.test(trimmed)
  ) {
    const date = new Date(trimmed);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  // For timezone-less event datetimes, preserve the
  // supplied local wall-clock time exactly.
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hours,
    minutes,
    seconds = "00",
  ] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

function normalizeConfidence(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(number))
  );
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isGenericPlaceholderTitle(title: string): boolean {
  const normalized = title
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const blockedTitles = [
    "music & nightlife experience",
    "mombasa live music & nightlife experience",
    "mombasa live music & dj night",
    "mombasa afrobeat & amapiano night",
    "live music & nightlife experience",
    "nightlife experience",
    "music and nightlife experience",
  ];

  return blockedTitles.includes(normalized);
}

function isInvalidSourceName(sourceName: string): boolean {
  const normalized = sourceName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized.includes("safariplug ai scout") ||
    normalized === "test scout" ||
    normalized === "ai scout" ||
    normalized === "safariplug"
  );
}

function isValidEvent(event: DiscoveredEvent): boolean {
  const title = normalizeText(event.title);
  const description = normalizeText(event.description);
  const sourceName = normalizeText(event.source_name);
  const sourceUrl = normalizeSourceUrl(event.source_url);
  const confidence = normalizeConfidence(
    event.confidence_score
  );
  const startAt = normalizeDate(event.start_at);

  if (!startAt) {
    console.warn(
      "Skipping event without a valid start date:",
      title
    );
    return false;
  }
  if (!title) {
    console.warn(
      "Skipping event without title."
    );
    return false;
  }

  if (!description) {
    console.warn(
      "Skipping event without description:",
      title
    );
    return false;
  }

  if (!sourceUrl) {
    console.warn(
      "Skipping event without valid external source:",
      title
    );
    return false;
  }

  if (isInvalidSourceName(sourceName)) {
    console.warn(
      "Skipping invalid source:",
      title,
      sourceName
    );
    return false;
  }

  if (isGenericPlaceholderTitle(title)) {
    console.warn(
      "Skipping generic placeholder event:",
      title
    );
    return false;
  }

  if (confidence < 60) {
    console.warn(
      "Skipping low-confidence event:",
      title,
      confidence
    );
    return false;
  }

  return true;
}

async function fetchEventImage(
  sourceUrl: string
): Promise<string | null> {
  try {
    console.log(
      "Fetching event image:",
      sourceUrl
    );

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(
        "Image page request failed:",
        response.status,
        sourceUrl
      );
      return null;
    }

    const html = await response.text();

    const candidates: string[] = [];

    const metaPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    for (const pattern of metaPatterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        candidates.push(match[1]);
      }
    }

    const imageMatches = html.matchAll(
      /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi
    );

    for (const match of imageMatches) {
      if (match[1]) {
        candidates.push(match[1]);
      }
    }

    for (const rawCandidate of candidates) {
      try {
        const imageUrl = new URL(
          rawCandidate,
          sourceUrl
        ).toString();

        const lower = imageUrl.toLowerCase();

        if (
          lower.includes("logo") ||
          lower.includes("icon") ||
          lower.includes("avatar") ||
          lower.includes("favicon") ||
          lower.includes("placeholder") ||
          lower.includes("sprite")
        ) {
          continue;
        }

        if (
          lower.startsWith("http://") ||
          lower.startsWith("https://")
        ) {
          console.log(
            "Found page image:",
            imageUrl
          );

          return imageUrl;
        }
      } catch {
        continue;
      }
    }

    console.log(
      "No usable event image found:",
      sourceUrl
    );

    return null;
  } catch (error) {
    console.warn(
      "IMAGE FETCH ERROR:",
      sourceUrl,
      error
    );

    return null;
  }
}

function normalizeEventIdentity(value: unknown): string {
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
  return normalizeEventIdentity(value)
    .replace(/\b(the|venue|grounds|centre|center)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeaningfulTitleTokens(value: unknown): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "live",
    "performance",
    "event",
    "festival",
    "party",
    "edition",
    "2026",
    "2027",
  ]);

  return normalizeEventIdentity(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !stopWords.has(token)
    );
}

function titlesShareMeaningfulIdentity(
  first: unknown,
  second: unknown
): boolean {
  const firstTokens =
    getMeaningfulTitleTokens(first);

  const secondTokens =
    getMeaningfulTitleTokens(second);

  if (
    firstTokens.length === 0 ||
    secondTokens.length === 0
  ) {
    return false;
  }

  const secondSet = new Set(secondTokens);

  const sharedTokens =
    firstTokens.filter((token) =>
      secondSet.has(token)
    );

  const minimumSharedTokens =
    Math.min(
      firstTokens.length,
      secondTokens.length
    ) === 1
      ? 1
      : 2;

  return (
    sharedTokens.length >=
    minimumSharedTokens
  );
}

async function findExistingEvent(
  title: string,
  sourceUrl: string,
  startAt: string | null,
  venueName: string,
  city: string
) {
  const normalizedTitle =
    normalizeEventIdentity(title);

  const normalizedSource =
    sourceUrl.trim().toLowerCase();

  const normalizedVenue =
    normalizeVenueIdentity(venueName);

  const normalizedCity =
    normalizeEventIdentity(city);

  const { data, error } =
    await supabaseAdmin
      .from("ai_discovered_events")
      .select(
        "id,title,source_url,start_at,venue_name,city"
      )
      .limit(500);

  if (error) {
    console.error(
      "DUPLICATE CHECK ERROR:",
      error
    );

    return null;
  }

  const duplicate =
    (data || []).find(
      (existing) => {
        const existingTitle =
          normalizeEventIdentity(
            existing.title
          );

        const existingSource =
          String(
            existing.source_url || ""
          )
            .trim()
            .toLowerCase();

        const existingVenue =
          normalizeVenueIdentity(
            existing.venue_name
          );

        const existingCity =
          normalizeEventIdentity(
            existing.city
          );

        const sameSource =
          existingSource ===
          normalizedSource;

        const sameTitle =
          existingTitle ===
          normalizedTitle;

        const sameDate =
          Boolean(startAt) &&
          Boolean(existing.start_at) &&
          String(
            existing.start_at
          ).slice(0, 10) ===
            String(startAt).slice(0, 10);

        const sameVenue =
          Boolean(normalizedVenue) &&
          Boolean(existingVenue) &&
          existingVenue ===
            normalizedVenue;

        const sameCity =
          Boolean(normalizedCity) &&
          Boolean(existingCity) &&
          existingCity ===
            normalizedCity;

        const sharedTitleIdentity =
          titlesShareMeaningfulIdentity(
            title,
            existing.title
          );

        const sameEventIdentity =
          sameDate &&
          sameCity &&
          sameVenue &&
          (
            sameTitle ||
            sharedTitleIdentity
          );

        return (
          sameSource ||
          sameTitle ||
          sameEventIdentity
        );
      }
    );

  return duplicate || null;
}
export async function runAIScout(
  formData: FormData
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured"
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const location = String(
    formData.get("location") || ""
  ).trim();

  const category = String(
    formData.get("category") || ""
  ).trim();

  if (!location || !category) {
    throw new Error(
      "Missing location or category"
    );
  }

  const { data: run, error: runError } =
    await supabaseAdmin
      .from("ai_scout_runs")
      .insert({
        location,
        category,
        status: "running",
        events_found: 0,
      })
      .select()
      .single();

  if (runError || !run) {
    console.error(
      "RUN ERROR:",
      runError
    );

    throw new Error(
      "Could not start AI Scout"
    );
  }

  try {
    const searchPrompt = [
      `Find real upcoming ${category} events or experiences in ${location}, Kenya.`,
      "",
      "Use live web search.",
      "",
      "SafariPlug is building a real event discovery platform.",
      "Only return genuine, currently discoverable events.",
      "Never invent, imagine, simulate, or suggest an event.",
      "Never create generic nightlife ideas.",
      "Never create placeholder events.",
      "Never create an event merely because the category exists.",
      "",
      "Search broadly across the live web.",
      "",
      "PRIORITY SOURCES:",
      "1. Official event websites.",
      "2. Official venue websites.",
      "3. Official organizer websites.",
      "4. Official ticketing platforms.",
      "5. Reputable event directories.",
      "6. Reputable local publications.",
      "",
      "Avoid low-quality pages when stronger evidence exists.",
      "",
      "For every event collect only evidence-backed information:",
      "- title",
      "- description",
      "- venue",
      "- venue address",
      "- city",
      "- actual upcoming start date/time",
      "- actual end date/time",
      "- ticket price",
      "- currency",
      "- official/source URL",
      "- source name",
      "- event image URL",
      "",
      "IMAGE RULES:",
      "Find the actual promotional image whenever possible.",
      "Prefer the image from the official event page.",
      "If unavailable, use the official venue or organizer image.",
      "Do not generate an image.",
      "Do not invent an image URL.",
      "If an image URL cannot be established from the source, return null.",
      "",
      "DATE RULES:",
      "Only provide a date when supported by the source.",
      "If the source says TBA, return null.",
      "Never invent a date.",
      "Never turn the current date into an event date.",
      "",
      "PRICE RULES:",
      "Only provide a price supported by the source.",
      "Unknown price MUST be null.",
      "Unknown price MUST NOT become zero.",
      "Do not describe an event as free unless the source explicitly says it is free.",
      "",
      "SOURCE RULES:",
      "Every event MUST have a real external HTTP or HTTPS source URL.",
      "Never use localhost.",
      "Never use SafariPlug admin URLs.",
      "Never use example.com.",
      "Never use SafariPlug AI Scout as a source.",
      "If a credible source cannot be established, exclude the event.",
      "",
      "QUALITY RULES:",
      "A generic title such as 'Music & Nightlife Experience' is invalid.",
      "A generic description is invalid.",
      "An event with no credible source is invalid.",
      "An event created only from a category is invalid.",
      "",
      "DUPLICATE RULE:",
      "Do not return duplicate events.",
      "",
      "CONFIDENCE:",
      "100 = event and major details strongly supported.",
      "80-99 = most major details supported by credible sources.",
      "60-79 = credible event but one or more details need verification.",
      "Below 60 = exclude.",
      "",
      "Return at most 5 real events.",
      "If no credible upcoming events are found, return an empty events array.",
      "",
      "Return ONLY valid JSON with exactly this structure:",
      "{",
      '  "events": [',
      "    {",
      '      "title": "string",',
      '      "description": "string",',
      '      "venue_name": "string or null",',
      '      "venue_address": "string or null",',
      '      "city": "string",',
      '      "start_at": "ISO datetime string or null",',
      '      "end_at": "ISO datetime string or null",',
      '      "price": "number or null",',
      '      "currency": "string or null",',
      '      "image_url": "string or null",',
      '      "source_url": "string",',
      '      "source_name": "string",',
      '      "confidence_score": 0',
      "    }",
      "  ]",
      "}",
    ].join("\n");

    const response =
      await openai.responses.create({
        model: "gpt-5.6-luna",
        tools: [
          {
            type: "web_search",
          },
        ],
        input: [
          {
            role: "system",
            content: [
              "You are SafariPlug AI Scout.",
              "You discover real upcoming events.",
              "Use live web information.",
              "Never invent an event.",
              "Never invent a source.",
              "Never invent an image.",
              "Never invent a date.",
              "Never invent a venue.",
              "Never invent a price.",
              "Unknown information must be null.",
              "Unknown price is not free.",
              "Every event requires a real external source.",
              "Never return SafariPlug admin URLs.",
              "Never return SafariPlug AI Scout as a source.",
              "Never return generic placeholder events.",
              "Return only valid JSON.",
            ].join(" "),
          },
          {
            role: "user",
            content: searchPrompt,
          },
        ],
      });

    const text =
      response.output_text?.trim();

    if (!text) {
      throw new Error(
        "AI returned an empty discovery response"
      );
    }

    let discovery: DiscoveryResponse;

    try {
      discovery = JSON.parse(text);
    } catch {
      console.error(
        "OPENAI JSON ERROR:",
        text
      );

      throw new Error(
        "AI returned invalid discovery data"
      );
    }

    if (
      !discovery ||
      !Array.isArray(
        discovery.events
      )
    ) {
      throw new Error(
        "AI returned an invalid events list"
      );
    }

    let insertedCount = 0;

    for (
      const event of discovery.events.slice(
        0,
        5
      )
    ) {
      if (!isValidEvent(event)) {
        continue;
      }

      const title =
        normalizeText(event.title);

      const description =
        normalizeText(
          event.description
        );

      const sourceUrl =
        normalizeSourceUrl(
          event.source_url
        );

      const sourceName =
        normalizeText(
          event.source_name
        );

      const venueName =
        normalizeText(
          event.venue_name
        );

      const venueAddress =
        normalizeText(
          event.venue_address
        );

      const city =
        normalizeText(
          event.city
        ) || location;

      const confidence =
        normalizeConfidence(
          event.confidence_score
        );

      if (!sourceUrl) {
        continue;
      }

      const startAt =
        normalizeDate(
          event.start_at
        );

      const endAt =
        normalizeDate(
          event.end_at
        );

      const duplicate =
        await findExistingEvent(
          title,
          sourceUrl,
          startAt,
          venueName,
          city
        );

      if (duplicate) {
        console.log(
          "Skipping duplicate event:",
          title
        );

        continue;
      }

      const price =
        normalizePrice(
          event.price
        );

      let imageUrl =
        normalizeImageUrl(
          event.image_url
        );

      if (!imageUrl) {
        imageUrl =
          await fetchEventImage(
            sourceUrl
          );
      }

      const currency =
        price !== null
          ? normalizeText(
              event.currency
            ) || "KES"
          : null;

      const { error: eventError } =
        await supabaseAdmin
          .from(
            "ai_discovered_events"
          )
          .insert({
            title,
            description,
            category,
            city,
            venue_name:
              venueName ||
              "To be verified",
            venue_address:
              venueAddress || null,
            start_at: startAt,
            end_at: endAt,
            price,
            currency,
            image_url: imageUrl,
            source_url: sourceUrl,
            source_name:
              sourceName ||
              "Web Source",
            confidence_score:
              confidence,
            status:
  "pending",
          });

      if (eventError) {
        console.error(
          "EVENT INSERT ERROR:",
          eventError
        );

        continue;
      }

      insertedCount++;

      console.log(
        "EVENT INSERTED:",
        title,
        "| IMAGE:",
        imageUrl || "NULL"
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        events_found:
          insertedCount,
        status: "completed",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", run.id);

    if (updateError) {
      console.error(
        "RUN UPDATE ERROR:",
        updateError
      );

      throw new Error(
        "Could not complete AI Scout run"
      );
    }

    revalidatePath(
      "/admin/ai-events"
    );

    revalidatePath(
      "/admin/ai-scout"
    );

    return;
  } catch (error) {
    console.error(
      "AI SCOUT ERROR:",
      error
    );

    const {
      error: failureUpdateError,
    } = await supabaseAdmin
      .from("ai_scout_runs")
      .update({
        status: "failed",
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", run.id);

    if (failureUpdateError) {
      console.error(
        "FAILED RUN UPDATE ERROR:",
        failureUpdateError
      );
    }

    throw error;
  }
}


