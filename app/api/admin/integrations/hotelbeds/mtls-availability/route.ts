import { createHash, createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { buildHotelbedsCertificationStay } from "@/lib/integrations/hotels/hotelbeds-certification-probe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function normalizedPem(primary: string, fallback: string) {
  const raw = env(primary) || env(fallback);
  if (!raw) return "";
  const unquoted = ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
    ? raw.slice(1, -1).trim()
    : raw;
  return unquoted.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function decodedPem(name: string) {
  const encoded = env(name);
  if (!encoded) return "";
  try {
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\r\n/g, "\n").trim();
  } catch {
    return "";
  }
}

function certificatePem() {
  return decodedPem("SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64")
    || normalizedPem("SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_CERT");
}

function privateKeyPem() {
  return decodedPem("SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_B64")
    || normalizedPem("SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY");
}

function environment() {
  return env("SAFARIPLUG_HOTEL_HOTELBEDS_ENV").toLowerCase() === "production" ? "production" : "test";
}

function mtlsBaseUrl() {
  return environment() === "production" ? "https://api-mtls.hotelbeds.com" : "https://api-mtls.test.hotelbeds.com";
}

function preflight() {
  const certificate = certificatePem();
  const key = privateKeyPem();
  const apiKey = env("SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY");
  const secret = env("SAFARIPLUG_HOTEL_HOTELBEDS_SECRET");

  if (!apiKey || !secret) throw new Error("Hotelbeds API key or secret is missing.");
  if (!certificate || !key) throw new Error("Hotelbeds mTLS certificate or key is missing.");

  const parsedCertificate = new X509Certificate(certificate);
  const parsedKey = createPrivateKey(key);
  const certPublic = parsedCertificate.publicKey.export({ type: "spki", format: "der" });
  const keyPublic = createPublicKey(parsedKey).export({ type: "spki", format: "der" });
  if (!Buffer.from(certPublic).equals(Buffer.from(keyPublic))) {
    throw new Error("Hotelbeds mTLS certificate and key do not match.");
  }

  return { certificate, key, apiKey, secret };
}

type SupplierErrorPayload = {
  error?: { message?: string; code?: string | number } | string;
  message?: string;
  code?: string | number;
};

type AvailabilityPayload = {
  hotels?: {
    total?: number;
    hotels?: Array<{
      code?: number | string;
      name?: string;
      currency?: string;
      rooms?: Array<{
        code?: string;
        name?: string;
        rates?: Array<{
          rateKey?: string;
          rateType?: string;
          rateClass?: string;
          net?: string | number;
          boardCode?: string;
          boardName?: string;
          cancellationPolicies?: Array<{ amount?: string | number; from?: string }>;
        }>;
      }>;
    }>;
  };
};

function firstRate(payload: AvailabilityPayload) {
  for (const hotel of payload.hotels?.hotels || []) {
    for (const room of hotel.rooms || []) {
      const rate = room.rates?.[0];
      if (rate) return { hotel, room, rate };
    }
  }
  return null;
}

function cancellationSummary(rate: NonNullable<ReturnType<typeof firstRate>>["rate"]) {
  const policy = rate.cancellationPolicies?.[0];
  if (!policy) return rate.rateClass === "NRF" ? "Non-refundable" : null;
  if (Number(policy.amount || 0) === 0 && policy.from) return `Free cancellation until ${policy.from}`;
  if (policy.from) return `Cancellation charges apply from ${policy.from}`;
  return rate.rateClass === "NRF" ? "Non-refundable" : "Cancellation restrictions may apply";
}

function supplierErrorMessage(payload: SupplierErrorPayload) {
  if (typeof payload.error === "string") return payload.error;
  return payload.error?.message || payload.message || "";
}

function supplierErrorCode(payload: SupplierErrorPayload) {
  const code = typeof payload.error === "object" ? payload.error?.code : undefined;
  const value = code ?? payload.code;
  return value === undefined || value === null ? null : String(value);
}

function runAvailability(codes: number[]) {
  const { certificate, key, apiKey, secret } = preflight();
  const stay = buildHotelbedsCertificationStay();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256").update(`${apiKey}${secret}${timestamp}`).digest("hex");
  const url = new URL("/hotel-api/1.0/hotels", mtlsBaseUrl());
  const body = JSON.stringify({
    stay: { checkIn: stay.checkIn, checkOut: stay.checkOut },
    occupancies: [{ rooms: 1, adults: 2, children: 0 }],
    hotels: { hotel: codes },
  });

  return new Promise<{ status: number; body: AvailabilityPayload | SupplierErrorPayload }>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "POST",
      cert: certificate,
      key,
      rejectUnauthorized: true,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Api-key": apiKey,
        "X-Signature": signature,
      },
      timeout: 20000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const raw = Buffer.concat(chunks);
        let decoded = raw;
        if (String(response.headers["content-encoding"] || "").toLowerCase().includes("gzip")) {
          try { decoded = gunzipSync(raw); } catch (error) { reject(error); return; }
        }
        const text = decoded.toString("utf8");
        let parsed: AvailabilityPayload | SupplierErrorPayload = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text.slice(0, 500) }; }
        resolve({ status: response.statusCode || 500, body: parsed });
      });
    });
    request.on("timeout", () => request.destroy(new Error("Hotelbeds availability probe timed out.")));
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

export async function POST() {
  try {
    await requireAdmin();

    const { data: cachedHotels, error } = await supabaseAdmin
      .from("hotelbeds_hotel_content")
      .select("hotel_code")
      .order("hotel_code", { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: `Unable to load cached Hotelbeds hotels: ${error.message}` }, { status: 500 });
    }

    const codes = (cachedHotels || [])
      .map((hotel) => Number(hotel.hotel_code))
      .filter((code) => Number.isInteger(code) && code > 0);

    if (!codes.length) {
      return NextResponse.json({ error: "No cached Hotelbeds hotel codes are available for the certification probe." }, { status: 409 });
    }

    const started = Date.now();
    const result = await runAvailability(codes);

    if (result.status < 200 || result.status >= 300) {
      const candidate = result.body as SupplierErrorPayload;
      return NextResponse.json({
        error: supplierErrorMessage(candidate) || `Hotelbeds Availability returned HTTP ${result.status}.`,
        supplierStatus: result.status,
        supplierCode: supplierErrorCode(candidate),
        supplierRequestCount: 1,
        transportAuthenticated: true,
        testedHotels: codes.length,
        environment: environment(),
        endpointMode: "mtls",
      }, { status: 502 });
    }

    const payload = result.body as AvailabilityPayload;
    const selected = firstRate(payload);
    const rate = selected?.rate;

    return NextResponse.json({
      ok: true,
      environment: environment(),
      endpointMode: "mtls",
      authenticated: true,
      latencyMs: Date.now() - started,
      supplierStatus: result.status,
      supplierRequestCount: 1,
      testedHotels: codes.length,
      resultCount: payload.hotels?.hotels?.length || 0,
      supplierTotal: payload.hotels?.total ?? null,
      sample: selected ? {
        propertyId: String(selected.hotel.code ?? ""),
        propertyName: selected.hotel.name || null,
        roomCode: selected.room.code || null,
        roomName: selected.room.name || null,
        currency: selected.hotel.currency || null,
        rateType: rate?.rateType || null,
        rateClass: rate?.rateClass || null,
        boardCode: rate?.boardCode || null,
        boardName: rate?.boardName || null,
        cancellation: rate ? cancellationSummary(rate) : null,
        hasRateKey: Boolean(rate?.rateKey),
      } : null,
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Hotelbeds mTLS availability probe failed.",
      supplierRequestCount: 0,
      environment: environment(),
      endpointMode: "mtls",
    }, { status });
  }
}
