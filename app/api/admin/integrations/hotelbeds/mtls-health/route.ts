import { createHash, createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

function runMtlsHealth() {
  const { certificate, key, apiKey, secret } = preflight();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256").update(`${apiKey}${secret}${timestamp}`).digest("hex");
  const url = new URL("/hotel-api/1.0/status", mtlsBaseUrl());

  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      cert: certificate,
      key,
      rejectUnauthorized: true,
      headers: {
        Accept: "application/json",
        "Api-key": apiKey,
        "X-Signature": signature,
      },
      timeout: 15000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let body: unknown = {};
        try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 500) }; }
        resolve({ status: response.statusCode || 500, body });
      });
    });
    request.on("timeout", () => request.destroy(new Error("Hotelbeds mTLS health check timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function POST() {
  try {
    await requireAdmin();
    const started = Date.now();
    const result = await runMtlsHealth();
    const body = result.body as { error?: { message?: string }; message?: string };
    if (result.status < 200 || result.status >= 300) {
      return NextResponse.json({
        error: body.error?.message || body.message || `Hotelbeds mTLS endpoint returned HTTP ${result.status}.`,
        supplierStatus: result.status,
        environment: environment(),
        endpointMode: "mtls",
      }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      environment: environment(),
      endpointMode: "mtls",
      authenticated: true,
      latencyMs: Date.now() - started,
      supplierStatus: result.status,
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Hotelbeds mTLS health check failed.",
      environment: environment(),
      endpointMode: "mtls",
    }, { status });
  }
}
