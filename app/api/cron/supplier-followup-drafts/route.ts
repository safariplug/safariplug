import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";
import { authorizedCronRequest } from "@/lib/auth/cron-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function requirementLink(requirement: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
  const base = `${site}/supplier/onboarding`;
  const normalized = requirement.toLowerCase();
  if (normalized.includes("business detail") || normalized.includes("description") || normalized.includes("business address")) return `${base}#business-details`;
  if (normalized.includes("business image") || normalized.includes("logo") || normalized.includes("cover image")) return `${base}#business-images`;
  if (normalized.includes("service pricing") || normalized.includes("service offering") || normalized.includes("pricing and duration")) return `${base}#services-pricing`;
  if (normalized.includes("availability") || normalized.includes("add at least one active service specialist") || normalized.includes("team member")) return `${base}#team-availability`;
  if (
    normalized.includes("personal photo") ||
    normalized.includes("identity + live face verification") ||
    normalized.includes("specialist identity") ||
    (normalized.includes("specialist") && (normalized.includes("verification") || normalized.includes("staff review")))
  ) return `${site}/business/services/identity`;
  if (normalized.includes("payout") || normalized.includes("m-pesa")) return `${site}/business/payouts`;
  if (
    normalized.includes("provider verification") ||
    normalized.includes("provider account") ||
    (normalized.includes("provider") && normalized.includes("staff review"))
  ) return `${site}/business/verification`;
  if (normalized.includes("verification")) return `${site}/supplier/readiness`;
  return base;
}

function draftMessage(input: { name: string; businessName: string; completion: number; missing: string[] }) {
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const list = input.missing.length ? `\n\nPlease complete the following:\n${input.missing.map((item) => `- ${item}: ${requirementLink(item)}`).join("\n")}` : "";
  return {
    subject: `SafariPlug onboarding follow-up for ${input.businessName}`,
    message: `${greeting}\n\nThis is a follow-up on your SafariPlug supplier onboarding. Your profile is currently ${input.completion}% complete.${list}\n\nYour progress is saved. Please sign in to continue:\n${portal}\n\nSafariPlug Supplier Team`,
  };
}

export async function GET(request: Request) {
  if (!(await authorizedCronRequest(request))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  try {
    const now = new Date().toISOString();
    const { data: due, error: dueError } = await supabaseAdmin
      .from("supplier_onboarding_followups")
      .select("supplier_id,sent_at,next_followup_due_at,missing_requirements")
      .eq("status", "sent")
      .lte("next_followup_due_at", now)
      .order("sent_at", { ascending: false })
      .limit(200);
    if (dueError) throw dueError;

    type DueRow = { supplier_id: string; sent_at: string; next_followup_due_at: string | null; missing_requirements: unknown };
    const candidates = new Map<string, DueRow | null>();
    for (const row of (due || []) as DueRow[]) if (!candidates.has(row.supplier_id)) candidates.set(row.supplier_id, row);

    const firstTouchCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: firstTouch, error: firstTouchError } = await supabaseAdmin
      .from("supplier_accounts")
      .select("id")
      .in("onboarding_status", ["draft", "onboarding", "in_progress", "changes_requested"])
      .lte("updated_at", firstTouchCutoff)
      .order("updated_at", { ascending: true })
      .limit(200);
    if (firstTouchError) throw firstTouchError;

    for (const supplier of firstTouch || []) {
      if (candidates.has(supplier.id)) continue;
      const { data: priorSent, error: priorSentError } = await supabaseAdmin
        .from("supplier_onboarding_followups")
        .select("id")
        .eq("supplier_id", supplier.id)
        .eq("status", "sent")
        .limit(1)
        .maybeSingle();
      if (priorSentError) throw priorSentError;
      if (!priorSent) candidates.set(supplier.id, null);
    }

    let prepared = 0;
    let skipped = 0;
    for (const [supplierId, previous] of candidates) {
      const { data: supplier, error } = await supabaseAdmin
        .from("supplier_accounts")
        .select("id,user_id,business_id,prospect_id,contact_name,onboarding_status,completion_percent,review_items,businesses!inner(id,name,email,service_profiles(id,service_staff(id)))")
        .eq("id", supplierId)
        .maybeSingle();
      if (error || !supplier || !["draft","onboarding","in_progress","changes_requested"].includes(String(supplier.onboarding_status || ""))) { skipped++; continue; }

      const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
      const recipient = clean(business?.email, 320).toLowerCase();
      if (!recipient || !recipient.includes("@")) { skipped++; continue; }

      const readiness = await getSupplierActivationReadiness(supplierId);
      const reviewRequested = (Array.isArray(supplier.review_items) ? supplier.review_items : [])
        .map((item) => `Review requested: ${label(String(item))}`);
      const workflowItems = readiness.ready && ["draft", "onboarding"].includes(String(supplier.onboarding_status || ""))
        ? ["Submit your onboarding for SafariPlug staff review"]
        : [];
      const supplierIssues = readiness.issues.filter((item) => item.owner === "supplier").map((item) => item.label);
      const platformIssues = readiness.issues.filter((item) => item.owner === "platform").map((item) => item.label);
      const missing = [...new Set([
        ...supplierIssues,
        ...reviewRequested,
        ...workflowItems,
      ])].slice(0, 20);

      // If the supplier has finished everything they control, stop preparing reminder emails.
      // Convert the blocker into an internal CRM follow-up for SafariPlug instead.
      if (!missing.length && platformIssues.length) {
        const { data: existingPrepared } = await supabaseAdmin
          .from("supplier_onboarding_followup_drafts")
          .select("id")
          .eq("supplier_id", supplierId)
          .eq("status", "prepared")
          .maybeSingle();
        if (existingPrepared) {
          const { error: supersedeError } = await supabaseAdmin
            .from("supplier_onboarding_followup_drafts")
            .update({ status: "superseded", updated_at: now })
            .eq("id", existingPrepared.id);
          if (supersedeError) throw supersedeError;
        }

        if (supplier.prospect_id) {
          const { data: existingInternal, error: internalLookupError } = await supabaseAdmin
            .from("crm_followups")
            .select("id")
            .eq("prospect_id", supplier.prospect_id)
            .eq("status", "open")
            .ilike("title", "SafariPlug action:%")
            .limit(1)
            .maybeSingle();
          if (internalLookupError) throw internalLookupError;

          const details = `Platform-owned supplier blockers: ${platformIssues.join("; ")}`;
          if (existingInternal) {
            const { error: internalUpdateError } = await supabaseAdmin
              .from("crm_followups")
              .update({
                title: "SafariPlug action: complete supplier activation setup",
                priority: "high",
                due_at: now,
                notes: details,
                updated_at: now,
              })
              .eq("id", existingInternal.id);
            if (internalUpdateError) throw internalUpdateError;
          } else {
            const { error: internalInsertError } = await supabaseAdmin.from("crm_followups").insert({
              prospect_id: supplier.prospect_id,
              title: "SafariPlug action: complete supplier activation setup",
              priority: "high",
              due_at: now,
              notes: details,
            });
            if (internalInsertError) throw internalInsertError;
          }
        }

        skipped++;
        continue;
      }

      const previousRequirements = previous && Array.isArray(previous.missing_requirements) ? previous.missing_requirements.map(String) : [];
      const comparison = previous ? {
        previousSentAt: previous.sent_at,
        resolvedSinceLast: previousRequirements.filter((item: string) => !missing.includes(item)),
        stillMissing: missing.filter((item) => previousRequirements.includes(item)),
        newlyMissing: missing.filter((item) => !previousRequirements.includes(item)),
      } : null;
      const draft = draftMessage({
        name: clean(supplier.contact_name, 200),
        businessName: clean(business?.name, 300) || "your business",
        completion: readiness.completionPercent,
        missing,
      });

      const { data: existing } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").select("id").eq("supplier_id",supplierId).eq("status","prepared").maybeSingle();
      if (existing) {
        const { error: updateError } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").update({
          recipient_email: recipient, subject: draft.subject, message: draft.message, missing_requirements: missing, comparison, prepared_at: now, updated_at: now,
        }).eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseAdmin.from("supplier_onboarding_followup_drafts").insert({
          supplier_id: supplierId, recipient_email: recipient, subject: draft.subject, message: draft.message, missing_requirements: missing, comparison, status: "prepared", prepared_at: now, updated_at: now,
        });
        if (insertError) throw insertError;
      }
      prepared++;
    }
    await supabaseAdmin.from("supplier_followup_prep_runs").insert({
      status: "success",
      checked_count: candidates.size,
      prepared_count: prepared,
      skipped_count: skipped,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, prepared, skipped, checked: candidates.size, firstTouchAfterHours: 24 });
  } catch (error) {
    console.error("Supplier follow-up draft preparation failed", error);
    const message = error instanceof Error ? error.message : "Draft preparation failed";
    await supabaseAdmin.from("supplier_followup_prep_runs").insert({
      status: "failed",
      checked_count: 0,
      prepared_count: 0,
      skipped_count: 0,
      error_message: message.slice(0, 1000),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    await requireAdmin();
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
    const internalRequest = new Request(request.url, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
    });
    return GET(internalRequest);
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Unable to run supplier follow-up preparation." }, { status: 500 });
  }
}
