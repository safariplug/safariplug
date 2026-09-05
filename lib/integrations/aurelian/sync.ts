import type { SupabaseClient } from "@supabase/supabase-js";
import { syncExperience } from "./adapter";
import { AURELIAN_PROVIDER, getAurelianConfig } from "./config";
import {
  AURELIAN_EVENT_SELECT,
  mapEventToAurelianExperience,
  type AurelianExperiencePayload,
} from "./payload";

export const SYNC_BATCH_LIMIT = 100;

export type SyncSummary = {
  success: true;
  inbound: {
    path: string;
    api_key_configured: boolean;
  };
  outbound: {
    available: boolean;
    reason: string | null;
  };
  scanned: number;
  mapped: number;
  recorded: number;
  synced: number;
  skipped: number;
  errors: number;
};

type CatalogClient = Pick<SupabaseClient, "from">;

async function recordSync(
  client: CatalogClient,
  eventId: string,
  status: "pending" | "synced" | "error" | "skipped" | "not_configured",
  errorMessage: string | null,
  externalId: string | null,
  payload: AurelianExperiencePayload | null
) {
  const now = new Date().toISOString();
  const { error } = await client.from("integration_syncs").upsert(
    {
      provider: AURELIAN_PROVIDER,
      safariplug_event_id: eventId,
      external_id: externalId,
      sync_status: status,
      last_error: errorMessage,
      last_synced_at: now,
      last_payload: payload
        ? {
            safariplug_event_id: payload.safariplug_event_id,
            title: payload.title,
            destination: payload.destination,
            start_at: payload.start_at,
          }
        : null,
      updated_at: now,
    },
    { onConflict: "provider,safariplug_event_id" }
  );
  if (error) {
    console.error("integration_syncs upsert failed", error.message);
    return false;
  }
  return true;
}

export async function syncApprovedExperiences(
  client: CatalogClient
): Promise<SyncSummary> {
  const config = getAurelianConfig();

  const { data, error } = await client
    .from("events")
    .select(AURELIAN_EVENT_SELECT)
    .eq("status", "approved")
    .order("start_at", { ascending: true })
    .limit(SYNC_BATCH_LIMIT);

  if (error) {
    console.error("aurelian sync load failed", error.message);
    throw new Error("Unable to load approved SafariPlug inventory.");
  }

  const rows = data ?? [];
  let mapped = 0;
  let recorded = 0;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const payload = mapEventToAurelianExperience(row);
    if (!payload) {
      skipped += 1;
      continue;
    }
    mapped += 1;

    if (!config.outboundContractAvailable) {
      const wrote = await recordSync(
        client,
        payload.safariplug_event_id,
        "not_configured",
        config.outboundBlockedReason,
        null,
        payload
      );
      if (wrote) recorded += 1;
      else errors += 1;
      skipped += 1;
      continue;
    }

    const result = await syncExperience(payload);
    if (!result.ok) {
      const wrote = await recordSync(
        client,
        payload.safariplug_event_id,
        "error",
        result.message,
        null,
        payload
      );
      if (wrote) recorded += 1;
      errors += 1;
      continue;
    }

    const wrote = await recordSync(
      client,
      payload.safariplug_event_id,
      "synced",
      null,
      result.data.externalId,
      payload
    );
    if (wrote) recorded += 1;
    synced += 1;
  }

  return {
    success: true,
    inbound: {
      path: "/api/integrations/aurelian/events",
      api_key_configured: config.inboundKeyConfigured,
    },
    outbound: {
      available: config.outboundContractAvailable,
      reason: config.outboundBlockedReason,
    },
    scanned: rows.length,
    mapped,
    recorded,
    synced,
    skipped,
    errors,
  };
}
