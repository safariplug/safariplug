import OpenAI from "openai";

export type DiscoveryResult = {
  business_name: string;
  category: string;
  city: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  contact_email?: string;
  phone?: string;
  description: string;
  notes?: string;
};

type DiscoveryResponse = {
  prospects: unknown;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceUrl(value: unknown): string | undefined {
  if (!isValidHttpUrl(value)) {
    return undefined;
  }

  const url = value.trim().replace(/[)\],.]+$/, "");
  const lower = url.toLowerCase();

  if (
    lower.startsWith("http://localhost") ||
    lower.startsWith("https://localhost") ||
    lower.includes("example.com") ||
    lower.includes("/admin/ai-scout") ||
    lower.includes("/admin/ai-sales")
  ) {
    return undefined;
  }

  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProspect(
  value: unknown,
  city: string,
  category: string
): DiscoveryResult | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const businessName = normalizeText(value.business_name);
  const discoveredCategory = normalizeText(value.category);
  const discoveredCity = normalizeText(value.city);
  const description = normalizeText(value.description);
  const sourceUrl = normalizeSourceUrl(value.source_url);
  const sourceName = normalizeText(value.source_name);

  if (
    !businessName ||
    discoveredCategory !== category ||
    discoveredCity.toLowerCase() !== city.toLowerCase() ||
    !description ||
    !sourceUrl ||
    !sourceName
  ) {
    return undefined;
  }

  const notes = [
    normalizeText(value.notes),
    `Source: ${sourceName} - ${sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    business_name: businessName,
    category,
    city,
    website: normalizeOptionalText(value.website),
    instagram: normalizeOptionalText(value.instagram),
    facebook: normalizeOptionalText(value.facebook),
    contact_email: normalizeOptionalText(value.contact_email),
    phone: normalizeOptionalText(value.phone),
    description,
    notes,
  };
}

export async function discoverBusinesses(
  city: string,
  category: string
): Promise<DiscoveryResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const searchPrompt = [
    `Find real businesses in ${city}, Kenya that operate in the ${category} category and could be relevant SafariPlug partners.`,
    "",
    "Use live web search.",
    "Only return genuine businesses with externally verifiable information.",
    "Never invent or infer a business, website, social account, email, phone number, address, or description.",
    "If a field is unavailable or not supported by a source, return null.",
    "Do not calculate or return a sales score.",
    "Do not contact, message, email, publish, approve, or modify any business.",
    "",
    "Prefer official business websites, official social accounts, reputable directories, and reputable local publications.",
    "Every prospect must have a real external HTTP or HTTPS source_url and source_name that support the business identity and category.",
    "Never use localhost, example.com, SafariPlug URLs, or generic placeholder businesses.",
    "Return only businesses whose city and category match the requested values.",
    "Return at most 10 prospects. Return an empty prospects array when no credible prospects are found.",
    "Return only valid JSON with exactly this structure:",
    "{",
    '  "prospects": [',
    "    {",
    '      "business_name": "string",',
    '      "category": "string",',
    '      "city": "string",',
    '      "website": "string or null",',
    '      "instagram": "string or null",',
    '      "facebook": "string or null",',
    '      "contact_email": "string or null",',
    '      "phone": "string or null",',
    '      "description": "string",',
    '      "source_url": "string",',
    '      "source_name": "string",',
    '      "notes": "string or null"',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const response = await openai.responses.create({
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
          "You are SafariPlug Sales Discovery.",
          "Use live web information to find real businesses.",
          "Never fabricate any field.",
          "Unknown fields must be null.",
          "Every returned prospect requires a credible external source.",
          "Return only valid JSON.",
        ].join(" "),
      },
      {
        role: "user",
        content: searchPrompt,
      },
    ],
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("AI returned an empty sales discovery response");
  }

  let discovery: DiscoveryResponse;

  try {
    discovery = JSON.parse(text) as DiscoveryResponse;
  } catch {
    throw new Error("AI returned invalid sales discovery data");
  }

  if (!discovery || !Array.isArray(discovery.prospects)) {
    throw new Error("AI returned an invalid prospects list");
  }

  const normalized = discovery.prospects
    .slice(0, 10)
    .map((prospect) => normalizeProspect(prospect, city, category))
    .filter((prospect): prospect is DiscoveryResult => Boolean(prospect));

  return normalized.filter(
    (prospect, index, prospects) =>
      prospects.findIndex(
        (candidate) =>
          candidate.business_name.toLowerCase() ===
            prospect.business_name.toLowerCase() &&
          candidate.city.toLowerCase() === prospect.city.toLowerCase()
      ) === index
  );
}