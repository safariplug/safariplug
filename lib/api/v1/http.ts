export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "configuration_error"
  | "unavailable"
  | "conflict"
  | "internal_error"
  | "hotel_inventory_not_configured"
  | "transfer_inventory_not_configured";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

const NO_STORE = { "cache-control": "no-store" };

export function jsonOk<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> }
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (init?.meta) {
    body.meta = init.meta;
  }
  return Response.json(body, {
    status: init?.status ?? 200,
    headers: NO_STORE,
  });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string
): Response {
  const body: ApiFailure = {
    success: false,
    error: { code, message },
  };
  return Response.json(body, { status, headers: NO_STORE });
}

export function configurationUnavailable(): Response {
  return jsonError(
    503,
    "configuration_error",
    "Public catalog is unavailable."
  );
}

export function catalogUnavailable(): Response {
  return jsonError(500, "internal_error", "Unable to load catalog.");
}

export function unauthorized(): Response {
  return jsonError(401, "unauthorized", "Authentication required.");
}

export function unavailable(message: string): Response {
  return jsonError(501, "unavailable", message);
}

export function conflict(message: string): Response {
  return jsonError(409, "conflict", message);
}
