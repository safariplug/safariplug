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
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const subject = input.status === "changes_requested"
    ? `SafariPlug onboarding updates needed for ${input.businessName}`
    : `Continue your SafariPlug supplier setup for ${input.businessName}`;
  const requested = input.reviewItems.length
    ? `\n\nSafariPlug is waiting for updates to: ${input.reviewItems.map(reviewLabel).join(", ")}.`
    : "";
  const note = input.reviewNote ? `\n\nStaff note: ${input.reviewNote}` : "";
  const progress = Number.isFinite(input.completion) ? ` Your profile is currently ${input.completion}% complete.` : "";
  const message = `${greeting}\n\nWe noticed your SafariPlug supplier setup still needs attention.${progress}${requested}${note}\n\nPlease sign in to your SafariPlug supplier portal to continue. Your progress is saved, so you can pick up where you left off.\n\nIf you need help with any requested item, use the AI Help option inside the supplier portal.\n\nSafariPlug Supplier Team`;
  return { subject, message };
}

async function loadSupplier(supplierId: string) {
  const { data: supplier, error } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,contact_name,onboarding_status,completion_percent,review_items,review_note,businesses!inner(name,email,phone)")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return supplier;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as {
      supplierId?: unknown;
      action?: unknown;
      subject?: unknown;
      message?: unknown;
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
    };

    if (action === "draft") {
      let draft = deterministicDraft(context);
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await openai.responses.create({
            model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
            max_output_tokens: 550,
            input: [
              { role: "system", content: "You draft concise SafariPlug supplier onboarding reminder emails for staff review. Use only supplied facts. Never invent deadlines, penalties, approvals, verification outcomes, prices, licenses, or missing requirements. Do not shame or pressure the supplier. Output JSON only with subject and message. The email must say progress is saved and direct the supplier to sign in to the SafariPlug supplier portal. If requested fixes exist, mention them plainly. Staff will edit and explicitly approve before sending." },
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
      return NextResponse.json({ recipient: to, subject: draft.subject, message: draft.message, source: process.env.OPENAI_API_KEY ? "ai_with_fallback" : "deterministic" });
    }

    const subject = clean(body?.subject, 180);
    const message = clean(body?.message, 5000);
    if (!subject || !message) return NextResponse.json({ error: "Subject and message are required before sending." }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
      to,
      subject,
      text: message,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    return NextResponse.json({ success: true, recipient: to });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process supplier follow-up." }, { status: 500 });
  }
}
