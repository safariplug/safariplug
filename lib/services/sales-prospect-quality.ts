export type SalesProspectQualityInput = {
  business_name?: string | null;
  city?: string | null;
  category?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  source_url?: string | null;
  source_name?: string | null;
};

function text(value: string | null | undefined) {
  return String(value || "").trim();
}

function placeholderUrl(value: string | null | undefined) {
  const raw = text(value).toLowerCase();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return ["example.com", "example.org", "example.net", "localhost"].includes(host);
  } catch {
    return false;
  }
}

export function salesProspectQualityIssues(input: SalesProspectQualityInput) {
  const issues: string[] = [];
  const name = text(input.business_name);
  const city = text(input.city);
  const category = text(input.category);
  const lowerName = name.toLowerCase();

  if (!name) issues.push("Business name is missing.");

  const syntheticNames = [
    `${city} ${category} Discovery`,
    `${city} ${category} Partner`,
    `${city} ${category} Prospect`,
  ].filter((value) => city && category && value.trim());

  if (syntheticNames.some((value) => value.toLowerCase() === lowerName)) {
    issues.push("Business name looks like a generated discovery placeholder.");
  }

  if (/^(test|demo|sample|placeholder)\b/i.test(name)) {
    issues.push("Business name looks like test or placeholder data.");
  }

  for (const [label, value] of [
    ["Website", input.website],
    ["Instagram", input.instagram],
    ["Facebook", input.facebook],
    ["Source URL", input.source_url],
  ] as const) {
    if (placeholderUrl(value)) issues.push(`${label} uses a placeholder domain.`);
  }

  const hasPublicPath = Boolean(
    text(input.contact_email) ||
    text(input.phone) ||
    text(input.website) ||
    text(input.instagram) ||
    text(input.facebook),
  );
  if (!hasPublicPath) issues.push("No public contact or research path is recorded.");

  if (!text(input.source_url) || !text(input.source_name)) {
    issues.push("Credible source evidence is incomplete.");
  }

  return issues;
}
