import { NextResponse } from "next/server";
import { Resend } from "resend";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

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
    ? `\n\nPlease complete the following:\n${input.missingRequirements.map((item) => `- ${item}`).join("\n")}`
    : "";
  const note = input.reviewNote ? `\n\nStaff note: ${input.reviewNote}` : "";
  const progress = Number.isFinite(input.completion) ? ` Your profile is currently ${input.completion}% complete.` : "";
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "")}/supplier/onboarding`;
  const message = `${greeting}\n\nWe noticed your SafariPlug supplier setup still needs attention.${progress}${requested}${note}\n\nPlease sign in to your SafariPlug supplier portal to continue. Your progress is saved, so you can pick up where you left off:\n${portal}\n\nIf you need help with any requested item, use the AI Help option inside the supplier portal.\n\nSafariPlug Supplier Team`;
  return { subject, message };
}

async function loadSupplier(supplierId: string) {
  const { data: supplier, error } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,contact_name,onboarding_status,completion_percent,review_items,review_note,businesses!inner(id,name,email,phone,description,logo_url,cover_image_url,service_profiles(id,status,booking_status,service_offerings(id,name,status,price,currency,duration_minutes),service_staff(id,display_name,personal_photo_url,status)))")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!supplier) return null;
  const { data: verification } = await supabaseAdmin
    .from("verification_cases")
    .select("status")
    .eq("subject_type", "provider")
    .eq("subject_id", supplier.business_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ...supplier, verification_status: verification?.status || null };
}

function inferMissingRequirements(supplier: NonNullable<Awaited<ReturnType<typeof loadSupplier>>>) {
  const business = Array.isArray(supplier.businesses) ? supplier.businesses[0] : supplier.businesses;
  const profilesRaw = business?.service_profiles;
  const profiles = Array.isArray(profilesRaw) ? profilesRaw : profilesRaw ? [profilesRaw] : [];
  const offerings = profiles.flatMap((profile) => Array.isArray(profile.service_offerings) ? profile.service_offerings : profile.service_offerings ? [profile.service_offerings] : []);
  const staff = profiles.flatMap((profile) => Array.isArray(profile.service_staff) ? profile.service_staff : profile.service_staff ? [profile.service_staff] : []);
  const missing: string[] = [];

  if (!clean(business?.description, 2000)) missing.push("Add a clear business description");
  if (!business?.logo_url && !business?.cover_image_url) missing.push("Add a business logo or cover image");
  if (!profiles.length) missing.push("Create your service profile");
  if (profiles.length && !offerings.length) missing.push("Add at least one service offering with pricing and duration");
  if (profiles.length && !staff.length) missing.push("Add at least one team member or service provider");
  if (staff.some((member) => !member.personal_photo_url)) missing.push("Add a personal photo for every listed team member");
  if (!supplier.verification_status) missing.push("Start supplier verification");
  else if (supplier.verification_status !== "approved") missing.push(`Complete supplier verification (currently ${reviewLabel(String(supplier.verification_status))})`);

  for (const item of Array.isArray(supplier.review_items) ? supplier.review_items : []) {
    const label = `Review requested: ${reviewLabel(String(item))}`;
    if (!missing.includes(label)) missing.push(label);
  }

  if (!missing.length && Number(supplier.completion_percent || 0) < 100) {
    missing.push("Complete the remaining onboarding steps shown in your supplier portal");
  }
  return missing.slice(0, 20);
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

    const context = {
      name: clean(supplier.contact_name, 200),
      businessName: clean(business?.name, 300) || "your business",
      status: String(supplier.onboarding_status || "draft"),
      completion: Number(supplier.completion_percent || 0),
      reviewItems: Array.isArray(supplier.review_items) ? supplier.review_items.map(String).slice(0, 20) : [],
      reviewNote: clean(supplier.review_note, 2000),
      missingRequirements: inferMissingRequirements(supplier),
    };

    if (action === "draft") {
      let draft = deterministicDraft(context);
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await openai.responses.create({
            model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
            max_output_tokens: 550,
            input: [
              { role: "system", content: "You draft concise SafariPlug supplier onboarding reminder emails for staff review. Use only supplied facts. Never invent deadlines, penalties, approvals, verification outcomes, prices, licenses, or missing requirements. Do not shame or pressure the supplier. Output JSON only with subject and message. The email must say progress is saved and direct the supplier to sign in to the SafariPlug supplier portal. Mention every supplied missing requirement plainly and do not add any missing requirement that was not supplied. Staff will edit and explicitly approve before sending." },
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
      return NextResponse.json({ recipient: to, subject: draft.subject, message: draft.message, missingRequirements: context.missingRequirements, source: process.env.OPENAI_API_KEY ? "ai_with_fallback" : "deterministic" });
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

    return NextResponse.json({ success: true, recipient: to, followup: history });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process supplier follow-up." }, { status: 500 });
  }
}
