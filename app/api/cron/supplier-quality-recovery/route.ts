import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  supplierQualityDueAt,
  supplierQualityRecovery,
  type SupplierQualityIssueKind,
} from "@/lib/services/supplier-quality-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

type ProfileIssue = {
  profileId: string;
  businessId: string;
  businessName: string;
  prospectId: string | null;
  partnerId: string | null;
  issues: Array<{ kind: SupplierQualityIssueKind; detail: string }>;
};

async function loadProfileIssues(): Promise<ProfileIssue[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [profilesResult, appointmentsResult, suppliersResult] = await Promise.all([
    supabaseAdmin
      .from("service_profiles")
      .select("id,business_id,status,booking_status,businesses(id,name,status),service_offerings(id,status,price,duration_minutes),service_staff(id,status,service_staff_availability(id,is_active))")
      .eq("status", "active")
      .limit(1000),
    supabaseAdmin
      .from("service_appointments")
      .select("id,service_profile_id,status,created_at")
      .gte("created_at", since)
      .limit(5000),
    supabaseAdmin
      .from("supplier_accounts")
      .select("id,business_id,prospect_id,partner_id,onboarding_status")
      .in("onboarding_status", ["approved", "live"])
      .limit(2000),
  ]);

  const error = profilesResult.error || appointmentsResult.error || suppliersResult.error;
  if (error) throw error;

  const supplierByBusiness = new Map(
    (suppliersResult.data || []).map((row: any) => [String(row.business_id), row]),
  );

  const stats = new Map<string, { completed: number; cancelled: number; noShow: number }>();
  for (const appointment of appointmentsResult.data || []) {
    const profileId = String((appointment as any).service_profile_id || "");
    if (!profileId) continue;
    const current = stats.get(profileId) || { completed: 0, cancelled: 0, noShow: 0 };
    if ((appointment as any).status === "completed") current.completed += 1;
    if ((appointment as any).status === "cancelled") current.cancelled += 1;
    if ((appointment as any).status === "no_show") current.noShow += 1;
    stats.set(profileId, current);
  }

  const result: ProfileIssue[] = [];

  for (const profile of profilesResult.data || []) {
    const supplier = supplierByBusiness.get(String((profile as any).business_id));
    if (!supplier) continue;

    const business = (profile as any).businesses;
    const offerings = Array.isArray((profile as any).service_offerings)
      ? (profile as any).service_offerings
      : (profile as any).service_offerings
        ? [(profile as any).service_offerings]
        : [];
    const staff = Array.isArray((profile as any).service_staff)
      ? (profile as any).service_staff
      : (profile as any).service_staff
        ? [(profile as any).service_staff]
        : [];

    const activeOfferings = offerings.filter(
      (row: any) => row.status === "active" && Number(row.price || 0) > 0 && Number(row.duration_minutes || 0) > 0,
    );
    const activeStaff = staff.filter((row: any) => row.status === "active");
    const hasAvailability = activeStaff.some((member: any) => {
      const availability = Array.isArray(member.service_staff_availability)
        ? member.service_staff_availability
        : member.service_staff_availability
          ? [member.service_staff_availability]
          : [];
      return availability.some((slot: any) => slot.is_active === true);
    });

    const profileStats = stats.get(String((profile as any).id)) || { completed: 0, cancelled: 0, noShow: 0 };
    const outcomeBase = profileStats.completed + profileStats.cancelled + profileStats.noShow;
    const failureRate = outcomeBase
      ? Math.round(((profileStats.cancelled + profileStats.noShow) / outcomeBase) * 100)
      : 0;

    const issues: ProfileIssue["issues"] = [];
    if ((profile as any).booking_status !== "open") {
      issues.push({ kind: "bookings_closed", detail: "The active service profile is not accepting bookings." });
    }
    if (!activeOfferings.length) {
      issues.push({ kind: "no_valid_offering", detail: "No active offering currently has both a positive price and duration." });
    }
    if (!activeStaff.length) {
      issues.push({ kind: "no_active_specialist", detail: "No active service specialist is attached to this live supplier." });
    } else if (!hasAvailability) {
      issues.push({ kind: "no_active_availability", detail: "Active specialists currently have no active availability." });
    }
    if (outcomeBase >= 3 && failureRate >= 25) {
      issues.push({
        kind: "high_cancel_no_show",
        detail: `30-day outcomes: ${profileStats.completed} completed, ${profileStats.cancelled} cancelled, ${profileStats.noShow} no-show (${failureRate}% cancellation/no-show).`,
      });
    }

    if (issues.length) {
      result.push({
        profileId: String((profile as any).id),
        businessId: String((profile as any).business_id),
        businessName: String((business as any)?.name || "Service provider"),
        prospectId: supplier.prospect_id ? String(supplier.prospect_id) : null,
        partnerId: supplier.partner_id ? String(supplier.partner_id) : null,
        issues,
      });
    }
  }

  return result;
}

async function reconcileRecoveryTasks() {
  const now = new Date().toISOString();
  const profiles = await loadProfileIssues();
  const activeKeys = new Set<string>();
  let created = 0;
  let updated = 0;
  let closed = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (!profile.prospectId) {
      skipped += profile.issues.length;
      continue;
    }

    for (const issue of profile.issues) {
      const recovery = supplierQualityRecovery(issue.kind, issue.detail);
      const key = `${profile.prospectId}:${issue.kind}`;
      activeKeys.add(key);
      const taskNote = [
        `Supplier: ${profile.businessName}`,
        `Profile: ${profile.profileId}`,
        `Recovery key: ${issue.kind}`,
        recovery.note,
        "This is an internal recovery task. Review evidence before contacting the supplier or changing marketplace state.",
      ].join("\n");

      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("crm_followups")
        .select("id,title,due_at,notes")
        .eq("prospect_id", profile.prospectId)
        .eq("status", "open")
        .eq("title", recovery.title)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from("crm_followups")
          .update({
            priority: recovery.priority,
            notes: taskNote,
            updated_at: now,
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
        updated += 1;
      } else {
        const { error: insertError } = await supabaseAdmin.from("crm_followups").insert({
          prospect_id: profile.prospectId,
          title: recovery.title,
          due_at: supplierQualityDueAt(recovery),
          priority: recovery.priority,
          notes: taskNote,
        });
        if (insertError) throw insertError;
        created += 1;

        await supabaseAdmin.from("crm_activities").insert({
          prospect_id: profile.prospectId,
          partner_id: profile.partnerId,
          activity_type: "system",
          summary: `Supplier recovery task created: ${recovery.title.replace("[Supplier quality] ", "")}`,
          details: taskNote,
        });
      }
    }
  }

  const prospectIds = [...new Set(profiles.map((row) => row.prospectId).filter(Boolean))] as string[];
  if (prospectIds.length) {
    const { data: openTasks, error: openTaskError } = await supabaseAdmin
      .from("crm_followups")
      .select("id,prospect_id,title,notes")
      .in("prospect_id", prospectIds)
      .eq("status", "open")
      .ilike("title", "[Supplier quality]%");
    if (openTaskError) throw openTaskError;

    for (const task of openTasks || []) {
      const notes = String((task as any).notes || "");
      const match = notes.match(/Recovery key:\s*([a-z_]+)/i);
      const issueKind = match?.[1] || "";
      const key = `${String((task as any).prospect_id)}:${issueKind}`;
      if (!issueKind || activeKeys.has(key)) continue;

      const { error: closeError } = await supabaseAdmin
        .from("crm_followups")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
          notes: `${notes}\nResolved automatically because the quality exception is no longer present.`,
        })
        .eq("id", (task as any).id);
      if (closeError) throw closeError;
      closed += 1;

      await supabaseAdmin.from("crm_activities").insert({
        prospect_id: (task as any).prospect_id,
        activity_type: "system",
        summary: "Supplier quality recovery resolved",
        details: `${(task as any).title} was closed because the underlying quality exception cleared.`,
      });
    }
  }

  return {
    checkedProfiles: profiles.length,
    activeIssues: profiles.reduce((sum, row) => sum + row.issues.length, 0),
    created,
    updated,
    closed,
    skipped,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileRecoveryTasks();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Supplier quality recovery reconciliation failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Recovery reconciliation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
    }
    return GET(new Request(request.url, { headers: { authorization: `Bearer ${secret}` } }));
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Unable to prepare supplier recovery tasks." }, { status: 500 });
  }
}
