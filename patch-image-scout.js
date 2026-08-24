const fs = require("fs");

const path = "app/admin/ai-scout/actions/run-scout.ts";

const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

// Lines 265-374 in the current file.
// Zero-based indexes 264 through 373.
const start = 264;
const count = 110;

const replacement = String.raw`async function fetchEventImage(
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

    const addCandidate = (value: unknown) => {
      if (typeof value !== "string" || !value.trim()) {
        return;
      }

      candidates.push(value.trim());
    };

    // 1. Open Graph and Twitter card images.
    const metaPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    for (const pattern of metaPatterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        addCandidate(match[1]);
      }
    }

    // 2. JSON-LD structured data.
    const jsonLdMatches = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    const collectJsonImages = (value: unknown) => {
      if (!value) {
        return;
      }

      if (typeof value === "string") {
        if (/^https?:\/\//i.test(value.trim())) {
          addCandidate(value);
        }

        return;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          collectJsonImages(item);
        }

        return;
      }

      if (typeof value === "object") {
        const obj = value as Record<string, unknown>;

        if (typeof obj.image === "string") {
          addCandidate(obj.image);
        } else if (obj.image) {
          collectJsonImages(obj.image);
        }
      }
    };

    for (const match of jsonLdMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        collectJsonImages(parsed);
      } catch {
        continue;
      }
    }

    // 3. Standard and lazy-loaded image elements.
    const imageMatches = html.matchAll(
      /<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi
    );

    for (const match of imageMatches) {
      if (match[1]) {
        addCandidate(match[1]);
      }
    }

    // 4. Responsive image sources.
    const srcsetMatches = html.matchAll(
      /(?:srcset|data-srcset)=["']([^"']+)["']/gi
    );

    for (const match of srcsetMatches) {
      if (!match[1]) {
        continue;
      }

      const entries = match[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      for (const entry of entries) {
        const parts = entry.split(/\s+/);

        if (parts[0]) {
          addCandidate(parts[0]);
        }
      }
    }

    // Validate candidates without inventing or generating images.
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
}`;

const replacementLines = replacement.split(/\r?\n/);

lines.splice(start, count, ...replacementLines);

fs.writeFileSync(
  path,
  lines.join("\n"),
  "utf8"
);

console.log("IMAGE SCOUT PATCH APPLIED");