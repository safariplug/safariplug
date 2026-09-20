import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function requirementLink(requirement: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
  const base = `${site}/supplier/onboarding`;
  if (requirement.toLowerCase().includes("business detail") || requirement.includes("description")) return `${base}#business-details`;
  if (requirement.toLowerCase().includes("business image") || requirement.includes("logo") || requirement.includes("cover image")) return `${base}#business-images`;
  if (requirement.toLowerCase().includes("service pricing") || requirement.includes("service offering") || requirement.includes("pricing and duration")) return `${base}#services-pricing`;
  if (requirement.toLowerCase().includes("availability") || requirement.toLowerCase().includes("add at least one active service specialist") || requirement.includes("team member")) return `${base}#team-availability`;
  if (requirement.toLowerCase().includes("personal photo") || requirement.toLowerCase().includes("identity + live face verification") || requirement.toLowerCase().includes("specialist identity")) return `${site}/business/services/identity`;
  if (requirement.toLowerCase().includes("payout") || requirement.includes("M-Pesa")) return `${site}/business/payouts`;
  if (requirement.toLowerCase().includes("provider") && requirement.toLowerCase().includes("verification")) return `${site}/business/verification`;
  if (requirement.includes("verification")) return `${site}/supplier/readiness`;
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
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
    const latestDue = new Map<string, DueRow>();
    for (const row of (due || []) as DueRow[]) if (!latestDue.has(row.supplier_id)) latestDue.set(row.supplier_id, row);

    let prepared = 0;
    let skipped = 0;
    for (const [supplierId, previous] of latestDue) {
      const { data: supplier, error } = await supabaseAdmin
        .from("supplier_accounts")
        .select("id,user_id,business_id,contact_name,onboarding_status,completion_percent,review_items,businesses!inner(id,name,email,service_profiles(id,service_staff(id)))")
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
      const missing = [...new Set([
        ...readiness.issues.filter((item) => item.owner === "supplier").map((item) => item.label),
        ...reviewRequested,
        ...workflowItems,
      ])].slice(0, 20);
      const previousRequirements = Array.isArray(previous.missing_requirements) ? previous.missing_requirements.map(String) : [];
      const comparison = {
        previousSentAt: previous.sent_at,
        resolvedSinceLast: previousRequirements.filter((item: string) => !missing.includes(item)),
        stillMissing: missing.filter((item) => previousRequirements.includes(item)),
        newlyMissing: missing.filter((item) => !previousRequirements.includes(item)),
      };
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
      checked_count: latestDue.size,
      prepared_count: prepared,
      skipped_count: skipped,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, prepared, skipped, checked: latestDue.size });
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
