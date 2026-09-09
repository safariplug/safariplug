import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

// Only appointment/service businesses are mapped here. Restaurants, hotels and
// event organizers use their dedicated supplier workflows and do not need a
// service_profiles row during partner signup.
const SERVICE_CATEGORY_BY_BUSINESS_TYPE: Record<string, string> = {
  Barber: "Barbers",
  "Hair & Beauty": "Hair & Beauty",
  "Spa & Massage": "Spas & Massage",
  "Tattoo & Body Art": "Tattoo Artists & Body Art",
  Nails: "Nails",
  "Lashes & Brows": "Lashes & Brows",
  Fitness: "Fitness & Personal Training",
  "Yoga / Pilates / Mindfulness": "Yoga, Pilates & Mindfulness",
  "Tour Operator": "Tours & Local Guides",
  "Local Guide": "Tours & Local Guides",
  "Experience Provider": "Tours & Local Guides",
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const businessName = typeof body?.business_name === "string" ? body.business_name.trim() : "";
    const businessType = typeof body?.business_type === "string" ? body.business_type.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!fullName || !email || !emailPattern.test(email) || !phone || !businessName || !businessType || password.length < 8) return NextResponse.json({ success: false, error: "Please complete all fields and use a password of at least 8 characters." }, { status: 400 });

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existingUsers?.users.some((user) => user.email?.toLowerCase() === email)) return NextResponse.json({ success: false, error: "An account already exists for this email. Please sign in instead." }, { status: 409 });

    const categoryName = SERVICE_CATEGORY_BY_BUSINESS_TYPE[businessType];
    const { data: category, error: categoryError } = categoryName
      ? await supabaseAdmin.from("service_categories").select("id,name").eq("name", categoryName).eq("status", "active").maybeSingle()
      : { data: null, error: null };
    if (categoryError) return NextResponse.json({ success: false, error: categoryError.message }, { status: 500 });
    if (categoryName && !category) return NextResponse.json({ success: false, error: "That business type is not currently available." }, { status: 422 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: fullName, phone, business_name: businessName, business_type: businessType, account_type: "supplier" } });
    if (authError || !authData.user) return NextResponse.json({ success: false, error: authError?.message ?? "Unable to create your account." }, { status: 500 });
    const userId = authData.user.id;
    const baseSlug = slugify(businessName) || `business-${crypto.randomUUID().slice(0, 8)}`;
    let slug = baseSlug;
    for (let i = 2; i < 100; i += 1) { const { data: taken } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle(); if (!taken) break; slug = `${baseSlug}-${i}`; }

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: fullName, email, phone, user_type: "partner" });
      if (profileError) throw new Error(profileError.message);
      const { data: business, error: businessError } = await supabaseAdmin.from("businesses").insert({ owner_id: userId, name: businessName, slug, business_type: businessType, phone, whatsapp: phone, email, status: "INACTIVE", verified: false, claimed: true }).select("id").single();
      if (businessError || !business) throw new Error(businessError?.message ?? "Unable to create business.");
      if (category) {
        const { error: serviceProfileError } = await supabaseAdmin.from("service_profiles").insert({ business_id: business.id, category_id: category.id, status: "pending", booking_status: "closed" });
        if (serviceProfileError) throw new Error(serviceProfileError.message);
      }
      const { error: supplierError } = await supabaseAdmin.from("supplier_accounts").insert({ user_id: userId, business_id: business.id, contact_name: fullName, invitation_status: "pending", onboarding_status: "draft" });
      if (supplierError) throw new Error(supplierError.message);

      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.safariplug.com";
      const redirectTo = `${appUrl.replace(/\/$/, "")}/auth/confirm`;
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
      if (linkError || !linkData?.properties?.action_link) throw new Error(linkError?.message ?? "Unable to create the email confirmation link.");
      const { Resend } = await import("resend");
      if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: emailError } = await resend.emails.send({ from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>", to: email, subject: "Confirm your SafariPlug business account", text: `Hello ${fullName},\n\nConfirm your SafariPlug business account here:\n\n${linkData.properties.action_link}\n\nAfter confirmation, you can finish your business profile, services, availability and photos.` });
      if (emailError) throw new Error(emailError.message);
      return NextResponse.json({ success: true, message: "Account created. Check your email to confirm your address, then finish your business profile." });
    } catch (error) { await supabaseAdmin.auth.admin.deleteUser(userId, true); throw error; }
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Signup failed." }, { status: 500 }); }
}
