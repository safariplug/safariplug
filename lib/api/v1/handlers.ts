import { getSupabaseAnonClient } from "@/lib/supabase-anon";
import {
  catalogUnavailable,
  configurationUnavailable,
  jsonError,
  jsonOk,
} from "./http";
import {
  getApprovedEvent,
  listDestinations,
  listEvents,
  listExperiences,
  searchCatalog,
  type CatalogClient,
} from "./catalog";
import {
  isUuid,
  ParamError,
  parseBoundedText,
  parseDateMode,
  parseFeatured,
  parseLimit,
  parsePage,
  parseRequiredQuery,
} from "./params";

function clientOrUnavailable():
  | { ok: true; client: CatalogClient }
  | { ok: false; response: Response } {
  const client = getSupabaseAnonClient();
  if (!client) {
    return { ok: false, response: configurationUnavailable() };
  }
  return { ok: true, client };
}

function badRequest(error: unknown): Response {
  const message =
    error instanceof ParamError ? error.message : "Invalid request.";
  return jsonError(400, "bad_request", message);
}

export async function handleListEvents(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const city = parseBoundedText(url.searchParams.get("city"), "city");
    const category = parseBoundedText(
      url.searchParams.get("category"),
      "category"
    );
    const featured = parseFeatured(url.searchParams.get("featured"));
    const when = parseDateMode(url.searchParams.get("when"));

    const ready = clientOrUnavailable();
    if (!ready.ok) return ready.response;

    const result = await listEvents(ready.client, {
      page,
      limit,
      city,
      category,
      featured,
      when,
    });
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, {
      meta: { page, limit, total: result.count },
    });
  } catch (error) {
    if (error instanceof ParamError) return badRequest(error);
    console.error("api.v1.events.unhandled", error);
    return catalogUnavailable();
  }
}

export async function handleGetEvent(
  _request: Request,
  id: string
): Promise<Response> {
  if (!id || !isUuid(id)) {
    return jsonError(400, "bad_request", "id must be a UUID.");
  }

  const ready = clientOrUnavailable();
  if (!ready.ok) return ready.response;

  const result = await getApprovedEvent(ready.client, id);
  if (!result.ok && result.reason === "db") return catalogUnavailable();
  if (!result.ok) {
    return jsonError(404, "not_found", "Event not found.");
  }
  return jsonOk(result.data);
}

export async function handleDestinations(): Promise<Response> {
  const ready = clientOrUnavailable();
  if (!ready.ok) return ready.response;
  const result = await listDestinations(ready.client);
  if (!result.ok) return catalogUnavailable();
  return jsonOk(result.data, { meta: { total: result.count } });
}

export async function handleExperiences(): Promise<Response> {
  const ready = clientOrUnavailable();
  if (!ready.ok) return ready.response;
  const result = await listExperiences(ready.client);
  if (!result.ok) return catalogUnavailable();
  return jsonOk(result.data);
}

export async function handleSearch(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = parseRequiredQuery(url.searchParams.get("q"));
    const page = parsePage(url.searchParams.get("page"));
    const limit = parseLimit(url.searchParams.get("limit"));

    const ready = clientOrUnavailable();
    if (!ready.ok) return ready.response;

    const result = await searchCatalog(ready.client, { q, page, limit });
    if (!result.ok) return catalogUnavailable();
    return jsonOk(result.data, {
      meta: { q, page, limit, total: result.count },
    });
  } catch (error) {
    if (error instanceof ParamError) return badRequest(error);
    console.error("api.v1.search.unhandled", error);
    return catalogUnavailable();
  }
}
