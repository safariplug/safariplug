import { liveTransferAdapters } from "@/lib/integrations/transfers/registry";
import {
  parseTransferSearchRequest,
  searchTransfers,
  transferAvailability,
  transferQuote,
} from "@/lib/services/transfers";
import { jsonError, jsonOk } from "./http";

export function transferInventoryNotConfigured(): Response {
  return jsonError(
    503,
    "transfer_inventory_not_configured",
    "Transfer inventory is not configured. No live transfer supplier is connected."
  );
}

function requireLive(): Response | null {
  if (liveTransferAdapters().length === 0) return transferInventoryNotConfigured();
  return null;
}

function fromError(code: string, message: string): Response {
  if (code === "not_configured" || code === "contract_required") {
    return transferInventoryNotConfigured();
  }
  if (code === "bad_request") return jsonError(400, "bad_request", message);
  return jsonError(503, "unavailable", message);
}

function queryMap(url: URL): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function handleTransferSearch(request: Request): Promise<Response> {
  const blocked = requireLive();
  if (blocked) return blocked;
  try {
    const query = parseTransferSearchRequest(queryMap(new URL(request.url)));
    const result = await searchTransfers(query);
    if (!result.ok) return fromError(result.error.code, result.error.message);
    return jsonOk(result.data.results, {
      meta: {
        inventory: "supplier",
        providers: liveTransferAdapters().length,
        total: result.data.results.length,
      },
    });
  } catch (error) {
    return jsonError(
      400,
      "bad_request",
      error instanceof Error ? error.message : "Invalid transfer search."
    );
  }
}

export async function handleTransferAvailability(
  request: Request
): Promise<Response> {
  const blocked = requireLive();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const transfer_id = url.searchParams.get("transfer_id")?.trim() || "";
    if (!transfer_id) throw new Error("transfer_id is required.");
    const query = parseTransferSearchRequest(queryMap(url));
    const result = await transferAvailability({ ...query, transfer_id });
    if (!result.ok) return fromError(result.error.code, result.error.message);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(
      400,
      "bad_request",
      error instanceof Error ? error.message : "Invalid availability request."
    );
  }
}

export async function handleTransferQuote(request: Request): Promise<Response> {
  const blocked = requireLive();
  if (blocked) return blocked;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = await transferQuote({
    provider: "external_supplier",
    transfer_id: String(body.transfer_id || ""),
    pickup: { kind: "city", name: String(body.pickup || "") },
    dropoff: { kind: "city", name: String(body.dropoff || "") },
    pickup_date: String(body.pickup_date || ""),
    adults: Number(body.adults || 1),
    children: Number(body.children || 0),
    infants: Number(body.infants || 0),
    luggage: Number(body.luggage || 0),
    supplier_amount: Number(body.supplier_amount),
    supplier_currency: String(body.supplier_currency || ""),
  });
  if (!result.ok) return fromError(result.error.code, result.error.message);
  return jsonOk(result.data);
}
