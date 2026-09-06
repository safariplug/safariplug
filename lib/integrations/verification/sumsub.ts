import crypto from "node:crypto";
import type { VerificationAdapter } from "./adapter";
import { NO_VERIFICATION_CAPABILITIES, type VerificationHealth, type VerificationResult } from "./types";

const API_BASE = process.env.SUMSUB_API_BASE_URL || "https://api.sumsub.com";
const APP_TOKEN = process.env.SUMSUB_APP_TOKEN || "";
const SECRET_KEY = process.env.SUMSUB_SECRET_KEY || "";
const LEVEL = process.env.SUMSUB_VERIFICATION_LEVEL || "";

function configured() {
  return Boolean(APP_TOKEN && SECRET_KEY && LEVEL);
}

function sign(ts: string, method: string, path: string, body: string) {
  return crypto.createHmac("sha256", SECRET_KEY).update(ts + method.toUpperCase() + path + body).digest("hex");
}

async function sumsubRequest(path: string, method: "GET" | "POST", body?: unknown) {
  if (!configured()) throw new Error("Sumsub is not configured.");
  const payload = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": APP_TOKEN,
      "X-App-Access-Ts": ts,
      "X-App-Access-Sig": sign(ts, method, path, payload),
    },
    body: payload || undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { description: text }; }
  if (!response.ok) throw new Error(`Sumsub ${response.status}: ${typeof data === "object" && data && "description" in data ? String((data as {description?:unknown}).description) : "request failed"}`);
  return data as Record<string, unknown>;
}

export async function createSumsubWebSdkLink(input: {
  userId: string;
  email?: string | null;
  phone?: string | null;
  redirectUrl?: string;
}) {
  const body: Record<string, unknown> = {
    levelName: LEVEL,
    userId: input.userId,
    ttlInSecs: 1800,
    applicantIdentifiers: {
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    },
  };
  if (input.redirectUrl) body.redirect = { successUrl: input.redirectUrl, failUrl: input.redirectUrl };
  const data = await sumsubRequest("/resources/sdkIntegrations/levels/-/websdkLink?lang=en&source=websdk", "POST", body);
  return { link: typeof data.url === "string" ? data.url : null, token: typeof data.token === "string" ? data.token : null };
}

export class SumsubVerificationAdapter implements VerificationAdapter {
  readonly key = "identity_provider" as const;
  readonly name = "Sumsub identity + liveness";
  capabilities() { return { identity: true, document: true, liveness: true, background: false, insurance: false, license: false }; }
  status() { return configured() ? "configured" as const : "not_configured" as const; }
  credentialsPresent() { return configured(); }
  contractImplemented() { return true; }
  async health(): Promise<VerificationHealth> {
    return { provider: this.key, status: this.status(), configured: configured(), contract_implemented: true, last_error: null, checked_at: new Date().toISOString() };
  }
  async requestExternalCheck(caseId: string): Promise<VerificationResult<{ external_id: string }>> {
    if (!configured()) return { ok: false, error: { code: "not_configured", message: "Sumsub credentials and SUMSUB_VERIFICATION_LEVEL are not configured." } };
    try {
      const data = await sumsubRequest(`/resources/applicants?levelName=${encodeURIComponent(LEVEL)}`, "POST", { externalUserId: `safariplug:${caseId}` });
      const id = typeof data.id === "string" ? data.id : null;
      if (!id) return { ok: false, error: { code: "bad_request", message: "Sumsub did not return an applicant ID." } };
      return { ok: true, data: { external_id: id } };
    } catch (error) {
      return { ok: false, error: { code: "bad_request", message: error instanceof Error ? error.message : "Unable to create Sumsub applicant." } };
    }
  }
}

export { configured as sumsubConfigured, LEVEL as sumsubVerificationLevel };
