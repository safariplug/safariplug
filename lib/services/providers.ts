import type { SupabaseClient } from "@supabase/supabase-js";
import { paginationRange } from "@/lib/api/v1/params";

export type CatalogClient = Pick<SupabaseClient, "from">;

export const PUBLIC_PROVIDER_SELECT =
  "id, name, slug, kind, provider_type, status, verification_status, city_id, location_label, service_area, capabilities, source, last_synced_at";

export type PublicProvider = {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  provider_type: string;
  status: "active";
  verification_status: string;
  city_id: string | null;
  location_label: string | null;
  service_area: string | null;
  capabilities: string[];
  source: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function toPublicProvider(row: unknown): PublicProvider | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const id = asString(data.id);
  const name = asString(data.name);
  if (!id || !name) return null;
  if (data.status !== "active") return null;
  return {
    id,
    name,
    slug: asString(data.slug),
    kind: asString(data.kind) || "business",
    provider_type: asString(data.provider_type) || "other",
    status: "active",
    verification_status: asString(data.verification_status) || "unverified",
    city_id: asString(data.city_id),
    location_label: asString(data.location_label),
    service_area: asString(data.service_area),
    capabilities: Array.isArray(data.capabilities)
      ? data.capabilities.filter((item): item is string => typeof item === "string")
      : [],
    source: asString(data.source) || "safariplug",
  };
}

export async function listActiveProviders(
  client: CatalogClient,
  input: { page: number; limit: number; type?: string }
) {
  const { from, to } = paginationRange(input.page, input.limit);
  let query = client
    .from("providers")
    .select(PUBLIC_PROVIDER_SELECT, { count: "exact" })
    .eq("status", "active");
  if (input.type) query = query.eq("provider_type", input.type);
  const { data, error, count } = await query
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) {
    console.error("providers.list", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  const rows = (data ?? [])
    .map(toPublicProvider)
    .filter((row): row is PublicProvider => row !== null);
  return { ok: true as const, data: rows, count: count ?? rows.length };
}

export async function getActiveProvider(client: CatalogClient, id: string) {
  const { data, error } = await client
    .from("providers")
    .select(PUBLIC_PROVIDER_SELECT)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("providers.get", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  const provider = toPublicProvider(data);
  if (!provider) return { ok: false as const, reason: "not_found" as const };
  return { ok: true as const, data: provider };
}
