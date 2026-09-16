import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const FALLBACK_ID = "00000000-0000-0000-0000-000000000000";

async function getSupplierAccount() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) return { error: NextResponse.json({ error: "Supplier authentication required." }, { status: 401 }) };
  const { data: account } = await supabaseAdmin.from("supplier_accounts")
    .select("id,business_id,onboarding_status,completion_percent,review_items,review_note")
    .eq("user_id", user.id).maybeSingle();
  if (!account) return { error: NextResponse.json({ error: "Supplier account not found." }, { status: 404 }) };
  return { account };
}

export async function GET() {
  const result = await getSupplierAccount();
  if (result.error) return result.error;
  const account = result.account!;
  return NextResponse.json({
    onboarding_status: account.onboarding_status,
    completion_percent: account.completion_percent,
    review_items: Array.isArray(account.review_items) ? account.review_items : [],
    review_note: account.review_note || null,
  });
}

export async function POST(request: Request) {
  const result = await getSupplierAccount();
  if (result.error) return result.error;
  const account = result.account!;

  const body = await request.json().catch(() => null) as { question?: string } | null;
  const question = String(body?.question || "").trim().slice(0, 1200);
  if (!question) return NextResponse.json({ error: "Ask a question about your onboarding." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI assistance is not configured." }, { status: 503 });

  const [{ data: business }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("businesses").select("name,description,business_type,address,phone,email,logo_url,cover_image_url,supplier_gallery_urls").eq("id", account.business_id).maybeSingle(),
    supabaseAdmin.from("service_profiles").select("id,status,booking_status,service_categories(name)").eq("business_id", account.business_id).maybeSingle(),
  ]);
  const { data: offerings } = await supabaseAdmin.from("service_offerings")
    .select("name,description,duration_minutes,price,currency,status")
    .eq("service_profile_id", profile?.id ?? FALLBACK_ID).limit(20);

  const response = await openai.responses.create({
    model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
    max_output_tokens: 700,
    input: [
      { role: "system", content: "You are SafariPlug Supplier Copilot. Help a supplier complete onboarding clearly and practically. Use only the supplied account context. Never invent facts, prices, licenses, verification, approval, publishing, or booking status. You may draft descriptions or service wording, explain requested fixes, and suggest what to complete next. Be concise and action-oriented. When a staff-requested fix is referenced, explain exactly what the supplier can update based only on the known profile data and staff note. Make clear that AI suggestions are drafts and the supplier must review before saving." },
      { role: "user", content: JSON.stringify({ question, onboarding_status: account.onboarding_status, completion_percent: account.completion_percent, requested_fixes: account.review_items, staff_note: account.review_note, business, profile, offerings: offerings ?? [] }) },
    ],
  });

  return NextResponse.json({ answer: response.output_text?.trim() || "AI guidance was unavailable. Please try again." });
}
