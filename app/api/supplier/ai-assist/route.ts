import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });

  const { data: account } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,onboarding_status,completion_percent,review_items,review_note")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "Supplier account not found." }, { status: 404 });

  const body = await request.json().catch(() => null) as { topic?: string; question?: string } | null;
  const topic = text(body?.topic).slice(0, 80) || "next onboarding step";
  const question = text(body?.question).slice(0, 1200);
  if (!question) return NextResponse.json({ error: "Ask a question about your onboarding." }, { status: 400 });

  const [{ data: business }, { data: profile }, { data: offerings }] = await Promise.all([
    supabaseAdmin.from("businesses").select("name,description,business_type,address,phone,email,logo_url,cover_image_url").eq("id", account.business_id).maybeSingle(),
    supabaseAdmin.from("service_profiles").select("status,booking_status,service_categories(name)").eq("business_id", account.business_id).maybeSingle(),
    supabaseAdmin.from("service_offerings").select("name,description,duration_minutes,price,currency,status").eq("service_profile_id", (await supabaseAdmin.from("service_profiles").select("id").eq("business_id", account.business_id).maybeSingle()).data?.id ?? "00000000-0000-0000-0000-000000000000").limit(20),
  ]);

  const response = await openai.responses.create({
    model: process.env.OPENAI_ASSIST_MODEL || "gpt-5-mini",
    max_output_tokens: 700,
    input: [
      { role: "system", content: "You are SafariPlug Supplier Copilot. Help the supplier complete onboarding clearly and practically. Use only the provided account context; never invent facts, prices, licenses, verification status, or business claims. You may draft text and suggest improvements, but never say the supplier is approved, verified, published, or bookable. Keep the answer concise. When useful, give: What to do, Suggested wording, and What SafariPlug staff will review." },
      { role: "user", content: JSON.stringify({ topic, question, onboarding_status: account.onboarding_status, completion_percent: account.completion_percent, requested_fixes: account.review_items, staff_note: account.review_note, business, profile, offerings: offerings ?? [] }) },
    ],
  });

  return NextResponse.json({ answer: response.output_text?.trim() || "I could not generate guidance right now." });
}
