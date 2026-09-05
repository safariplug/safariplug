import type { SupabaseClient } from "@supabase/supabase-js";
import { paginationRange } from "@/lib/api/v1/params";

export type CatalogClient = Pick<SupabaseClient, "from">;

export const SERVICE_KINDS = [
  "personal_service",
  "adventure",
  "activity",
  "safari",
  "tour",
] as const;

export const TRANSFER_KINDS = ["transfer", "driver", "vehicle"] as const;

export const PUBLIC_OFFERING_SELECT =
  "id, kind, provider_id, event_id, title, description, city_id, category, status, start_at, end_at, source";

export type PublicOffering = {
  id: string;
  kind: string;
  provider_id: string | null;
  event_id: string | null;
  title: string;
  description: string | null;
  city_id: string | null;
  category: string | null;
  status: "approved";
  start_at: string | null;
  end_at: string | null;
  source: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function toPublicOffering(row: unknown): PublicOffering | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const id = asString(data.id);
  const title = asString(data.title);
  const kind = asString(data.kind);
  if (!id || !title || !kind) return null;
  if (data.status !== "approved") return null;
  return {
    id,
    kind,
    provider_id: asString(data.provider_id),
    event_id: asString(data.event_id),
    title,
    description: asString(data.description),
    city_id: asString(data.city_id),
    category: asString(data.category),
    status: "approved",
    start_at: asString(data.start_at),
    end_at: asString(data.end_at),
    source: asString(data.source) || "safariplug",
  };
}

export async function listApprovedOfferings(
  client: CatalogClient,
  input: { page: number; limit: number; kinds: readonly string[] }
) {
  const { from, to } = paginationRange(input.page, input.limit);
  const { data, error, count } = await client
    .from("offerings")
    .select(PUBLIC_OFFERING_SELECT, { count: "exact" })
    .eq("status", "approved")
    .in("kind", [...input.kinds])
    .order("title", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) {
    console.error("offerings.list", error.message);
    return { ok: false as const, reason: "db" as const };
  }
  const rows = (data ?? [])
    .map(toPublicOffering)
    .filter((row): row is PublicOffering => row !== null);
  return { ok: true as const, data: rows, count: count ?? rows.length };
}
