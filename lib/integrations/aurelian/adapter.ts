import {
  AURELIAN_GET_EXPERIENCE_PATH,
  AURELIAN_HEALTH_PATH,
  AURELIAN_SYNC_EXPERIENCE_PATH,
  getAurelianAuthHeader,
  getAurelianConfig,
} from "./config";
import type { AurelianExperiencePayload } from "./payload";

export type AdapterResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: "not_configured" | "contract_required" | "request_failed";
      message: string;
    };

export type AurelianHealth = {
  reachable: boolean;
  configured: boolean;
  contractAvailable: boolean;
};

async function aurelianRequest(
  path: string,
  init: RequestInit
): Promise<AdapterResult<unknown>> {
  const config = getAurelianConfig();
  if (!config.outboundBaseUrl) {
    return {
      ok: false,
      code: "not_configured",
      message:
        config.outboundBlockedReason ||
        "Aurelian outbound API is not configured.",
    };
  }

  const auth = getAurelianAuthHeader();
  if (!auth) {
    return {
      ok: false,
      code: "not_configured",
      message: "SAFARIPLUG_AURELIAN_API_KEY is not configured.",
    };
  }

  const url = `${config.outboundBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("x-api-key", auth["x-api-key"]);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(url, { ...init, headers });
    const text = await response.text();
    if (!response.ok) {
      console.error("Aurelian request failed", {
        status: response.status,
        path,
      });
      return {
        ok: false,
        code: "request_failed",
        message: `Aurelian request failed (${response.status}).`,
      };
    }
    if (!text) return { ok: true, data: null };
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      return { ok: true, data: text };
    }
  } catch (error) {
    console.error("Aurelian request error", {
      path,
      name: error instanceof Error ? error.name : "error",
    });
    return {
      ok: false,
      code: "request_failed",
      message: "Aurelian request failed.",
    };
  }
}

export async function healthCheck(): Promise<AdapterResult<AurelianHealth>> {
  const config = getAurelianConfig();
  if (!config.outboundContractAvailable || !AURELIAN_HEALTH_PATH) {
    return {
      ok: false,
      code: config.outboundBaseUrl ? "contract_required" : "not_configured",
      message:
        config.outboundBlockedReason ||
        "Aurelian outbound API contract is not available.",
    };
  }
  const result = await aurelianRequest(AURELIAN_HEALTH_PATH, { method: "GET" });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      reachable: true,
      configured: true,
      contractAvailable: true,
    },
  };
}

export async function syncExperience(
  payload: AurelianExperiencePayload
): Promise<AdapterResult<{ externalId: string | null }>> {
  const config = getAurelianConfig();
  if (!config.outboundContractAvailable || !AURELIAN_SYNC_EXPERIENCE_PATH) {
    return {
      ok: false,
      code: config.outboundBaseUrl ? "contract_required" : "not_configured",
      message:
        config.outboundBlockedReason ||
        "Aurelian outbound API contract is not available.",
    };
  }

  const result = await aurelianRequest(AURELIAN_SYNC_EXPERIENCE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) return result;
  const data = result.data as { id?: unknown; external_id?: unknown } | null;
  const externalId =
    (typeof data?.id === "string" && data.id) ||
    (typeof data?.external_id === "string" && data.external_id) ||
    null;
  return { ok: true, data: { externalId } };
}

export async function getExperience(
  externalId: string
): Promise<AdapterResult<unknown>> {
  const config = getAurelianConfig();
  if (!config.outboundContractAvailable || !AURELIAN_GET_EXPERIENCE_PATH) {
    return {
      ok: false,
      code: config.outboundBaseUrl ? "contract_required" : "not_configured",
      message:
        config.outboundBlockedReason ||
        "Aurelian outbound API contract is not available.",
    };
  }
  const path = AURELIAN_GET_EXPERIENCE_PATH.replace(
    ":id",
    encodeURIComponent(externalId)
  );
  return aurelianRequest(path, { method: "GET" });
}

export async function updateExperience(
  externalId: string,
  payload: AurelianExperiencePayload
): Promise<AdapterResult<unknown>> {
  const config = getAurelianConfig();
  if (!config.outboundContractAvailable || !AURELIAN_GET_EXPERIENCE_PATH) {
    return {
      ok: false,
      code: config.outboundBaseUrl ? "contract_required" : "not_configured",
      message:
        config.outboundBlockedReason ||
        "Aurelian outbound API contract is not available.",
    };
  }
  const path = AURELIAN_GET_EXPERIENCE_PATH.replace(
    ":id",
    encodeURIComponent(externalId)
  );
  return aurelianRequest(path, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
