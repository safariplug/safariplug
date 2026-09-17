import { createHash } from "node:crypto";

export type HotelbedsProduct = "activities" | "transfers";

type ProductConfig = {
  apiKey?: string;
  secret?: string;
  environment: "test" | "production";
  baseUrl: string;
};

export class HotelbedsProductRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HotelbedsProductRequestError";
    this.status = status;
    this.code = code;
  }
}

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function prefix(product: HotelbedsProduct) {
  return product === "activities"
    ? "SAFARIPLUG_HOTELBEDS_ACTIVITIES"
    : "SAFARIPLUG_HOTELBEDS_TRANSFERS";
}

function scalar(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function supplierErrorDetails(data: unknown) {
  if (!data || typeof data !== "object") return {} as { message?: string; code?: string };
  const candidate = data as Record<string, unknown>;
  const nested = candidate.error && typeof candidate.error === "object"
    ? candidate.error as Record<string, unknown>
    : undefined;

  const message =
    scalar(nested?.message) ||
    scalar(nested?.description) ||
    scalar(candidate.message) ||
    scalar(candidate.description) ||
    scalar(candidate.error);

  const code =
    scalar(nested?.code) ||
    scalar(nested?.errorCode) ||
    scalar(candidate.code) ||
    scalar(candidate.errorCode) ||
    (typeof candidate.error === "string" && candidate.error !== message
      ? scalar(candidate.error)
      : undefined);

  return { message, code };
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
      const details = supplierErrorDetails(data);
      throw new HotelbedsProductRequestError(
        details.message || `Hotelbeds ${product} returned HTTP ${response.status}.`,
        response.status,
        details.code
      );
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
