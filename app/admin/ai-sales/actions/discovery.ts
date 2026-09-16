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
  source_url?: string;
  source_name?: string;
  description: string;
  notes?: string;
};

type DiscoveryResponse = { prospects: unknown };

const CITY_COUNTRY: Record<string, string> = {
  Nairobi: "Kenya", Mombasa: "Kenya", Diani: "Kenya", Kilifi: "Kenya", Malindi: "Kenya", Watamu: "Kenya", Lamu: "Kenya",
  Zanzibar: "Tanzania", Kampala: "Uganda", "Dar es Salaam": "Tanzania", Accra: "Ghana", Lagos: "Nigeria",
  "Cape Town": "South Africa", Johannesburg: "South Africa", Cairo: "Egypt", Casablanca: "Morocco",
};

function normalizeText(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function normalizeOptionalText(value: unknown): string | undefined { const text = normalizeText(value); return text || undefined; }
function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try { const url = new URL(value.trim()); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}
function normalizeSourceUrl(value: unknown): string | undefined {
  if (!isValidHttpUrl(value)) return undefined;
  const url = value.trim().replace(/[)\],.]+$/, "");
  const lower = url.toLowerCase();
  if (lower.startsWith("http://localhost") || lower.startsWith("https://localhost") || lower.includes("example.com") || lower.includes("/admin/ai-scout") || lower.includes("/admin/ai-sales")) return undefined;
  return url;
}
function normalizePublicUrl(value: unknown): string | undefined { return normalizeSourceUrl(value); }
function isValidEmail(value: unknown): boolean { const email=normalizeText(value); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function hasUsefulPhone(value: unknown): boolean { const phone=normalizeText(value); return phone.replace(/\D/g,"").length>=7; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

function normalizeProspect(value: unknown, city: string, category: string): DiscoveryResult | undefined {
  if (!isRecord(value)) return undefined;
  const businessName = normalizeText(value.business_name);
  const discoveredCategory = normalizeText(value.category);
  const discoveredCity = normalizeText(value.city);
  const description = normalizeText(value.description);
  const sourceUrl = normalizeSourceUrl(value.source_url);
  const sourceName = normalizeText(value.source_name);
  if (!businessName || discoveredCategory !== category || discoveredCity.toLowerCase() !== city.toLowerCase() || !description || !sourceUrl || !sourceName) return undefined;
  const website=normalizePublicUrl(value.website), instagram=normalizePublicUrl(value.instagram), facebook=normalizePublicUrl(value.facebook);
  const contactEmail=isValidEmail(value.contact_email)?normalizeText(value.contact_email):undefined;
  const phone=hasUsefulPhone(value.phone)?normalizeText(value.phone):undefined;
  // A prospect must be actionable now or have an official public property that can support governed contact research.
  if (!contactEmail && !phone && !website && !instagram && !facebook) return undefined;
  const contactReadiness=contactEmail||phone?"Contact-ready: public email or phone found.":"Needs contact research: official public web/social property found, but no public email or phone was verified.";
  const notes = [normalizeText(value.notes), contactReadiness, `Source: ${sourceName} - ${sourceUrl}`].filter(Boolean).join("\n");
  return {
    business_name: businessName, category, city,
    website, instagram, facebook, contact_email:contactEmail, phone, source_url: sourceUrl, source_name: sourceName, description, notes,
  };
}

export async function discoverBusinesses(city: string, category: string): Promise<DiscoveryResult[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const country = CITY_COUNTRY[city] || "an African country";
  const searchPrompt = [
    `Find real businesses in ${city}, ${country}, Africa that operate in the ${category} category and could be relevant SafariPlug partners.`,
    "Use live web search. Discovery is not complete until you also perform contact enrichment for each candidate.",
    "For every candidate, actively search the official website, contact page, official Instagram/Facebook profile, and other credible public sources for a business email or business phone number.",
    "Prioritize prospects with a publicly verified business email or phone number because they are immediately actionable for governed outreach.",
    "If no public email or phone can be verified, include the business only when at least one official website, Instagram URL, or Facebook URL is verified so a human or later enrichment step has an actionable research path.",
    "Do not return a business that has no verified email, phone, official website, official Instagram URL, and official Facebook URL.",
    "Only return genuine businesses with externally verifiable information.",
    "Never invent or infer a business, website, social account, email, phone number, address, decision-maker, or description.",
    "If a field is unavailable or not supported by a source, return null.",
    "Do not calculate or return a sales score.",
    "Do not contact, message, email, publish, approve, or modify any business.",
    "Prefer official business websites, official social accounts, reputable directories, and reputable local publications.",
    "Every prospect must have a real external HTTP or HTTPS source_url and source_name supporting the business identity and category.",
    "Only include publicly listed business contact details. Never return private personal contact information.",
    "If a public business phone number is explicitly shown as WhatsApp-capable by the source, mention that fact in notes; otherwise do not claim WhatsApp availability.",
    "Never use localhost, example.com, SafariPlug URLs, or generic placeholder businesses.",
    "Return only businesses whose city and category match the requested values.",
    "Return at most 10 prospects. Return an empty prospects array when no credible actionable prospects are found.",
    "Return only valid JSON with exactly this structure:",
    "{", '  "prospects": [', "    {", '      "business_name": "string",', '      "category": "string",', '      "city": "string",', '      "website": "string or null",', '      "instagram": "string or null",', '      "facebook": "string or null",', '      "contact_email": "string or null",', '      "phone": "string or null",', '      "description": "string",', '      "source_url": "string",', '      "source_name": "string",', '      "notes": "string or null"', "    }", "  ]", "}",
  ].join("\n");

  const response = await openai.responses.create({
    model: process.env.OPENAI_SALES_SCOUT_MODEL || "gpt-5-mini",
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: "You are SafariPlug Supplier Discovery for Africa. Discover and enrich contacts using live web information. Never fabricate fields. Prefer public business email/phone; otherwise require an official public website or social profile for later contact research. Return only valid JSON." },
      { role: "user", content: searchPrompt },
    ],
  });
  const text = response.output_text?.trim();
  if (!text) throw new Error("AI returned an empty supplier discovery response");
  let discovery: DiscoveryResponse;
  try { discovery = JSON.parse(text) as DiscoveryResponse; } catch { throw new Error("AI returned invalid supplier discovery data"); }
  if (!discovery || !Array.isArray(discovery.prospects)) throw new Error("AI returned an invalid prospects list");
  const normalized = discovery.prospects.slice(0, 10).map((prospect) => normalizeProspect(prospect, city, category)).filter((prospect): prospect is DiscoveryResult => Boolean(prospect));
  return normalized.filter((prospect, index, prospects) => prospects.findIndex((candidate) => candidate.business_name.toLowerCase() === prospect.business_name.toLowerCase() && candidate.city.toLowerCase() === prospect.city.toLowerCase()) === index);
}
