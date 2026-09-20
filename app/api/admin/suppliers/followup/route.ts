import { NextResponse } from "next/server";
import { Resend } from "resend";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";

const ELIGIBLE_STATUSES = new Set(["draft", "onboarding", "changes_requested"]);

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function reviewLabel(value: string) {
  return value.replaceAll("_", " ");
}

function requirementLink(requirement: string) {
  const base = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  if (requirement.toLowerCase().includes("business detail") || requirement.includes("description")) return `${base}#business-details`;
  if (requirement.toLowerCase().includes("business image") || requirement.includes("logo") || requirement.includes("cover image")) return `${base}#business-images`;
  if (requirement.toLowerCase().includes("service pricing") || requirement.includes("service offering") || requirement.includes("pricing and duration")) return `${base}#services-pricing`;
  if (requirement.toLowerCase().includes("availability") || requirement.toLowerCase().includes("add at least one active service specialist") || requirement.includes("team member")) return `${base}#team-availability`;
  if (requirement.toLowerCase().includes("personal photo") || requirement.toLowerCase().includes("identity + live face verification") || requirement.toLowerCase().includes("specialist identity")) return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/business/services/identity`;
  if (requirement.toLowerCase().includes("payout") || requirement.includes("M-Pesa")) return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/business/payouts`;
  if (requirement.toLowerCase().includes("provider") && requirement.toLowerCase().includes("verification")) return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/business/verification`;
  if (requirement.includes("verification")) return `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/readiness`;
  return base;
}

function deterministicDraft(input: {
  name: string;
  businessName: string;
  status: string;
  completion: number;
  reviewItems: string[];
  reviewNote: string;
  missingRequirements: string[];
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const subject = input.status === "changes_requested"
    ? `SafariPlug onboarding updates needed for ${input.businessName}`
    : `Continue your SafariPlug supplier setup for ${input.businessName}`;
  const requested = input.missingRequirements.length
    ? `\n\nPlease complete the following:\n${input.missingRequirements.map((item) => `- ${item}: ${requirementLink(item)}`).join("\n")}`
    : "";
  const note = input.reviewNote ? `\n\nStaff note: ${input.reviewNote}` : "";
  const progress = Number.isFinite(input.completion) ? ` Your profile is currently ${input.completion}% complete.` : "";
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  const message = `${greeting}\n\nWe noticed your SafariPlug supplier setup still needs attention.${progress}${requested}${note}\n\nPlease sign in to your SafariPlug supplier portal to continue. Your progress is saved, so you can pick up where you left off:\n${portal}\n\nSafariPlug Supplier Team`;
  return { subject, message };
}

async function loadSupplier(supplierId: string) {
  const { data: supplier, error } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,contact_name,onboarding_status,completion_percent,review_items,review_note,businesses!inner(id,name,email,phone)")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return supplier ?? null;
}

function inferMissingRequirements(
  supplier: NonNullable<Awaited<ReturnType<typeof loadSupplier>>>,
  canonicalIssues: string[],
) {
  const missing = [...canonicalIssues];
  for (const item of Array.isArray(supplier.review_items) ? supplier.review_items : []) {
    const label = `Review requested: ${reviewLabel(String(item))}`;
    if (!missing.includes(label)) missing.push(label);
  }
  if (!missing.length && Number(supplier.completion_percent || 0) < 100) {
    missing.push("Complete the remaining onboarding steps shown in your supplier portal");
  }
  return [...new Set(missing)].slice(0, 20);
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null) as {
      supplierId?: unknown;
      action?: unknown;
      subject?: unknown;
      message?: unknown;
      approved?: unknown;
      nextFollowupDueAt?: unknown;
    } | null;

    const supplierId = clean(body?.supplierId, 100);
    const action = clean(body?.action, 40);
    if (!supplierId || !["draft", "send"].includes(action)) {
      return NextResponse.json({ error: "Supplier and valid follow-up action are required." }, { status: 400 });
    }

    const supplier = await loadSupplier(supplierId);
    if (!supplier) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    if (!ELIGIBLE_STATUSES.has(String(supplier.onboarding_status || ""))) {
      return NextResponse.json({ error: "This supplier is not eligible for an onboarding follow-up." }, { status: 409 });
    }

    const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
    const to = clean(business?.email, 320).toLowerCase();
    if (!validEmail(to)) return NextResponse.json({ error: "Supplier does not have a valid business email." }, { status: 422 });

    const { data: previousFollowup } = await supabaseAdmin
      .from("supplier_onboarding_followups")
      .select("id,missing_requirements,sent_at,subject")
      .eq("supplier_id", supplierId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const activationReadiness = await getSupplierActivationReadiness(supplierId);
    const canonicalIssues = activationReadiness.issues.map((item) => item.label);
    if (activationReadiness.ready && ["draft", "onboarding"].includes(String(supplier.onboarding_status || ""))) {
      canonicalIssues.push("Submit your onboarding for SafariPlug staff review");
    }
    const missingRequirements = inferMissingRequirements(supplier, canonicalIssues);
    const previousRequirements = Array.isArray(previousFollowup?.missing_requirements)
      ? previousFollowup.missing_requirements.map(String)
      : [];
    const resolvedSinceLast = previousRequirements.filter((item) => !missingRequirements.includes(item));
    const stillMissing = missingRequirements.filter((item) => previousRequirements.includes(item));
    const newlyMissing = missingRequirements.filter((item) => !previousRequirements.includes(item));

    const context = {
      name: clean(supplier.contact_name, 200),
      businessName: clean(business?.name, 300) || "your business",
      status: String(supplier.onboarding_status || "draft"),
      completion: activationReadiness.completionPercent,
      reviewItems: Array.isArray(supplier.review_items) ? supplier.review_items.map(String).slice(0, 20) : [],
      reviewNote: clean(supplier.review_note, 2000),
      missingRequirements,
      previousFollowup: previousFollowup ? {
        sentAt: previousFollowup.sent_at,
        subject: previousFollowup.subject,
        previousRequirements,
        resolvedSinceLast,
        stillMissing,
        newlyMissing,
      } : null,
    };

    if (action === "draft") {
      let draft = deterministicDraft(context);
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await openai.responses.create({
            model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
            max_output_tokens: 550,
            input: [
              { role: "system", content: "You draft concise SafariPlug supplier onboarding reminder emails for staff review. Use only supplied facts. Never invent deadlines, penalties, approvals, verification outcomes, prices, licenses, or missing requirements. Do not shame or pressure the supplier. Output JSON only with subject and message. The email must say progress is saved and direct the supplier to sign in to the SafariPlug supplier portal. Mention every CURRENT missing requirement plainly and do not add any missing requirement that was not supplied. If previousFollowup exists, acknowledge resolvedSinceLast briefly when non-empty, focus the reminder on stillMissing and newlyMissing, and do not ask again for resolved items. Staff will edit and explicitly approve before sending." },
              { role: "user", content: JSON.stringify(context) },
            ],
          });
          const text = response.output_text?.trim() || "";
          const parsed = JSON.parse(text) as { subject?: unknown; message?: unknown };
          const subject = clean(parsed.subject, 180);
          const message = clean(parsed.message, 5000);
          if (subject && message) draft = { subject, message };
        } catch {
          // Keep deterministic draft when AI is unavailable or returns invalid JSON.
        }
      }
      return NextResponse.json({
        recipient: to,
        subject: draft.subject,
        message: draft.message,
        missingRequirements: context.missingRequirements,
        followupComparison: context.previousFollowup ? {
          previousSentAt: context.previousFollowup.sentAt,
          resolvedSinceLast: context.previousFollowup.resolvedSinceLast,
          stillMissing: context.previousFollowup.stillMissing,
          newlyMissing: context.previousFollowup.newlyMissing,
        } : null,
        source: process.env.OPENAI_API_KEY ? "ai_with_fallback" : "deterministic"
      });
    }

    if (body?.approved !== true) return NextResponse.json({ error: "Staff review and explicit approval are required before sending." }, { status: 400 });
    const subject = clean(body?.subject, 180);
    const message = clean(body?.message, 5000);
    const nextFollowupDueAt = clean(body?.nextFollowupDueAt, 100);
    const parsedDue = nextFollowupDueAt ? Date.parse(nextFollowupDueAt) : NaN;
    const dueAt = Number.isFinite(parsedDue) && parsedDue > Date.now()
      ? new Date(parsedDue).toISOString()
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    if (!subject || !message) return NextResponse.json({ error: "Subject and message are required before sending." }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });

    const { data: recent } = await supabaseAdmin
      .from("supplier_onboarding_followups")
      .select("id,sent_at,subject")
      .eq("supplier_id", supplierId)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      return NextResponse.json({
        error: `A supplier follow-up was already sent within the last 24 hours (${new Date(recent.sent_at).toLocaleString()}). Review the history before sending another reminder.`,
        duplicateProtected: true,
      }, { status: 409 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
      to,
      subject,
      text: message,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    const sentAt = new Date().toISOString();
    const { data: history, error: historyError } = await supabaseAdmin
      .from("supplier_onboarding_followups")
      .insert({
        supplier_id: supplierId,
        recipient_email: to,
        subject,
        message,
        missing_requirements: context.missingRequirements,
        status: "sent",
        sent_at: sentAt,
        next_followup_due_at: dueAt,
        created_by: admin.id,
      })
      .select("id,sent_at,next_followup_due_at")
      .single();

    if (historyError || !history) {
      return NextResponse.json({
        error: "Email was sent, but SafariPlug could not record the follow-up history. Do not resend until the delivery is reconciled.",
        sent: true,
        recipient: to,
      }, { status: 500 });
    }

    await supabaseAdmin
      .from("supplier_onboarding_followup_drafts")
      .update({ status: "used", updated_at: new Date().toISOString() })
      .eq("supplier_id", supplierId)
      .eq("status", "prepared");

    return NextResponse.json({ success: true, recipient: to, followup: history });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process supplier follow-up." }, { status: 500 });
  }
}
