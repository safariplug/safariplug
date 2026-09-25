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

function hostFor(value: string | null | undefined) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function placeholderHost(host: string | null) {
  if (!host) return false;
  return (
    host === "localhost" ||
    host === "example.com" ||
    host.endsWith(".example.com") ||
    host === "example.org" ||
    host.endsWith(".example.org") ||
    host === "example.net" ||
    host.endsWith(".example.net")
  );
}

function safariPlugHost(host: string | null) {
  return Boolean(host && (host === "safariplug.com" || host.endsWith(".safariplug.com")));
}

function usableEmail(value: string | null | undefined) {
  const email = text(value).toLowerCase();
  if (!email) return false;
  if (
    email.includes("[email") ||
    email.includes("protected") ||
    email.includes("noreply") ||
    email.includes("no-reply") ||
    email.includes("example.")
  ) return false;
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function usablePhone(value: string | null | undefined) {
  const raw = text(value);
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return !/^1234567/.test(digits);
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
    const raw = text(value);
    if (!raw) continue;
    const host = hostFor(raw);
    if (!host) {
      issues.push(`${label} is not a valid HTTP/HTTPS URL.`);
    } else if (placeholderHost(host)) {
      issues.push(`${label} uses a placeholder domain.`);
    }
  }

  if (text(input.contact_email) && !usableEmail(input.contact_email)) {
    issues.push("Business email is invalid or placeholder data.");
  }
  if (text(input.phone) && !usablePhone(input.phone)) {
    issues.push("Business phone does not look usable.");
  }
  if (!usableEmail(input.contact_email) && !usablePhone(input.phone)) {
    issues.push("No direct public business email or phone is recorded.");
  }

  const sourceHost = hostFor(input.source_url);
  if (!text(input.source_url) || !text(input.source_name)) {
    issues.push("Credible source evidence is incomplete.");
  } else if (!sourceHost || placeholderHost(sourceHost) || safariPlugHost(sourceHost)) {
    issues.push("Source URL must be a credible external HTTP/HTTPS source.");
  }

  return [...new Set(issues)];
}
