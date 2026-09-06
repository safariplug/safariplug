import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS } from "../config";
import { supabase } from "../auth";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number | null;
    q?: string;
  };
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(`${API_PREFIX}${path}`, `${API_BASE_URL}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiSuccess<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { accept: "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(buildUrl(path, params), {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const failure = body as ApiFailure | null;
      throw new ApiError(
        response.status,
        failure?.error?.code || "http_error",
        failure?.error?.message || `Request failed (${response.status}).`
      );
    }
    if (
      !body ||
      typeof body !== "object" ||
      (body as ApiSuccess<T>).success !== true
    ) {
      throw new ApiError(500, "malformed_response", "Unexpected API response.");
    }
    return body as ApiSuccess<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(408, "timeout", "Request timed out.");
    }
    throw new ApiError(0, "network_error", "Unable to reach SafariPlug.");
  } finally {
    clearTimeout(timer);
  }
}

export function apiBaseUrl(): string {
  return API_BASE_URL;
}
