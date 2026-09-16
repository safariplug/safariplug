import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

const FALLBACK_ID = "00000000-0000-0000-0000-000000000000";
const REVIEW_ITEMS = [
  "business_details",
  "business_images",
  "services_pricing",
  "team",
  "personal_photos",
  "availability",
  "verification",
  "payout_details",
  "other",
] as const;
const REVIEW_ITEM_SET = new Set<string>(REVIEW_ITEMS);

type StructuredReview = {
  summary?: string;
  complete?: string[];
  issues?: string[];
  questions?: string[];
  suggestedReviewItems?: string[];
  draftReviewNote?: string;
};

function parseStructuredReview(raw: string): StructuredReview | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as StructuredReview;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12)
    : [];
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { supplierId?: string; prompt?: string } | null;
    const supplierId = String(body?.supplierId || "").trim();
    const prompt = String(body?.prompt || "Summarize this supplier and suggest review items.").trim().slice(0, 1200);
    if (!supplierId) return NextResponse.json({ error: "Supplier is required." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI assistance is not configured." }, { status: 503 });

    const { data: account, error: accountError } = await supabaseAdmin.from("supplier_accounts")
      .select("id,business_id,contact_name,onboarding_status,completion_percent,review_items,review_note,submitted_at,approved_at")
      .eq("id", supplierId).maybeSingle();
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
    if (!account) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });

    const [{ data: business }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("businesses").select("name,description,business_type,address,phone,email,logo_url,cover_image_url,supplier_gallery_urls,status,verified").eq("id", account.business_id).maybeSingle(),
      supabaseAdmin.from("service_profiles").select("id,status,booking_status,service_categories(name)").eq("business_id", account.business_id).maybeSingle(),
    ]);
    const profileId = profile?.id ?? FALLBACK_ID;
    const [{ data: offerings }, { data: staff }, { data: verification }] = await Promise.all([
      supabaseAdmin.from("service_offerings").select("name,description,duration_minutes,price,currency,status").eq("service_profile_id", profileId).limit(30),
      supabaseAdmin.from("service_staff").select("display_name,personal_photo_url,status").eq("service_profile_id", profileId).limit(30),
      supabaseAdmin.from("verification_cases").select("status,subject_type,created_at,updated_at").eq("subject_type", "provider").eq("subject_id", account.business_id).limit(20),
    ]);

    const response = await openai.responses.create({
      model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
      max_output_tokens: 1100,
      input: [
        {
          role: "system",
          content: `You are SafariPlug Staff Review Assistant. Analyze only the supplied supplier record. Never approve, reject, verify, publish, activate bookings, infer identity, or invent facts. Return JSON only with keys: summary (string), complete (string[]), issues (string[]), questions (string[]), suggestedReviewItems (string[]), draftReviewNote (string). suggestedReviewItems may only use these exact codes: ${REVIEW_ITEMS.join(", ")}. Only suggest a code when the supplied record gives a concrete reason to inspect it. draftReviewNote must be concise, respectful, factual, editable by staff, and must not claim AI made a final decision. Human review is always required.`,
        },
        { role: "user", content: JSON.stringify({ prompt, supplier: account, business, profile, offerings: offerings ?? [], staff: staff ?? [], verification: verification ?? [] }) },
      ],
    });

    const raw = response.output_text?.trim() || "";
    const parsed = parseStructuredReview(raw);
    if (!parsed) {
      return NextResponse.json({
        answer: raw || "AI review was unavailable.",
        summary: raw || "AI review was unavailable.",
        complete: [],
        issues: [],
        questions: [],
        suggestedReviewItems: [],
        draftReviewNote: "",
      });
    }

    const suggestedReviewItems = Array.from(new Set(textList(parsed.suggestedReviewItems).filter((item) => REVIEW_ITEM_SET.has(item))));
    const summary = String(parsed.summary || "").trim().slice(0, 2500);
    const complete = textList(parsed.complete);
    const issues = textList(parsed.issues);
    const questions = textList(parsed.questions);
    const draftReviewNote = String(parsed.draftReviewNote || "").trim().slice(0, 2000);
    const answer = [
      summary,
      complete.length ? `\nWhat looks complete\n- ${complete.join("\n- ")}` : "",
      issues.length ? `\nPossible issues to check\n- ${issues.join("\n- ")}` : "",
      questions.length ? `\nQuestions for the supplier\n- ${questions.join("\n- ")}` : "",
    ].filter(Boolean).join("\n").trim();

    return NextResponse.json({ answer, summary, complete, issues, questions, suggestedReviewItems, draftReviewNote });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to generate AI supplier review." }, { status: 500 });
  }
}
