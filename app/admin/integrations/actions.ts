"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncApprovedExperiences } from "@/lib/integrations/aurelian";

export type SyncActionState = {
  ok: boolean;
  message: string;
  scanned?: number;
  mapped?: number;
  recorded?: number;
  synced?: number;
  skipped?: number;
};

export async function runAurelianSync(): Promise<SyncActionState> {
  try {
    await requireAdmin();
    const summary = await syncApprovedExperiences(supabaseAdmin);
    revalidatePath("/admin/integrations");
    const reason = summary.outbound.reason
      ? ` ${summary.outbound.reason}`
      : "";
    return {
      ok: true,
      message: summary.outbound.available
        ? `Sync finished. Synced ${summary.synced} of ${summary.mapped} mapped events.`
        : `Foundation recorded ${summary.recorded} approved events. Outbound Aurelian sync is not live.${reason}`,
      scanned: summary.scanned,
      mapped: summary.mapped,
      recorded: summary.recorded,
      synced: summary.synced,
      skipped: summary.skipped,
    };
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return { ok: false, message: error.message };
    }
    console.error("AURELIAN SYNC ACTION ERROR");
    return { ok: false, message: "Unable to run Aurelian sync." };
  }
}
