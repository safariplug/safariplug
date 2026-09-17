import { createHash } from "node:crypto";

export type HotelbedsProduct = "activities" | "transfers";

type ProductConfig = {
  apiKey?: string;
  secret?: string;
  environment: "test" | "production";
  baseUrl: string;
};

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function prefix(product: HotelbedsProduct) {
  return product === "activities"
    ? "SAFARIPLUG_HOTELBEDS_ACTIVITIES"
    : "SAFARIPLUG_HOTELBEDS_TRANSFERS";
}

export function hotelbedsProductSignature(
  apiKey: string,
  secret: string,
  timestampSeconds = Math.floor(Date.now() / 1000)
) {
  return createHash("sha256")
    .update(`${apiKey}${secret}${timestampSeconds}`)
    .digest("hex");
}

export function hotelbedsProductConfig(product: HotelbedsProduct): ProductConfig {
  const base = prefix(product);
  const environment =
    (env(`${base}_ENV`) || "test").toLowerCase() === "production"
      ? "production"
      : "test";
  return {
    apiKey: env(`${base}_API_KEY`),
    secret: env(`${base}_SECRET`),
    environment,
    baseUrl:
      environment === "production"
        ? "https://api.hotelbeds.com"
        : "https://api.test.hotelbeds.com",
  };
}

export function hotelbedsProductConfigured(product: HotelbedsProduct) {
  const config = hotelbedsProductConfig(product);
  return Boolean(config.apiKey && config.secret);
}

export async function hotelbedsProductRequest<T>(
  product: HotelbedsProduct,
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const config = hotelbedsProductConfig(product);
  if (!config.apiKey || !config.secret) {
    throw new Error(`Hotelbeds ${product} API key and secret are not configured.`);
  }

  const method = init.method || "GET";
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Api-key": config.apiKey,
        "X-Signature": hotelbedsProductSignature(config.apiKey, config.secret),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const candidate = data as {
        error?: { message?: string };
        message?: string;
      };
      throw new Error(
        candidate.error?.message ||
          candidate.message ||
          `Hotelbeds ${product} returned HTTP ${response.status}.`
      );
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
