import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
    const contactName = typeof body?.contactName === "string" ? body.contactName.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const categorySlug = typeof body?.categorySlug === "string" ? body.categorySlug.trim() : "";
    const cityId = typeof body?.cityId === "string" && body.cityId ? body.cityId : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!businessName || !contactName || !email || !emailPattern.test(email) || !categorySlug) {
      return NextResponse.json({ success: false, error: "Business name, contact name, valid email, and category are required." }, { status: 400 });
    }

    const { data: category, error: categoryError } = await supabaseAdmin.from("service_categories").select("id,name,slug").eq("slug", categorySlug).eq("status", "active").maybeSingle();
    if (categoryError) return NextResponse.json({ success: false, error: categoryError.message }, { status: 500 });
    if (!category) return NextResponse.json({ success: false, error: "Service category not found." }, { status: 422 });

    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const already = existingUser.users.find((u) => u.email?.toLowerCase() === email);
    if (already) {
      const { data: linked } = await supabaseAdmin.from("supplier_accounts").select("id,business_id,onboarding_status").eq("user_id", already.id).maybeSingle();
      if (linked) return NextResponse.json({ success: false, error: "A supplier account already exists for this email." }, { status: 409 });
      return NextResponse.json({ success: false, error: "This email already has a SafariPlug account. Use a different email for the supplier owner." }, { status: 409 });
    }

    const baseSlug = slugify(businessName) || `supplier-${crypto.randomUUID().slice(0, 8)}`;
    let slug = baseSlug;
    for (let i = 2; i < 100; i++) {
      const { data: taken } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: contactName, account_type: "supplier" },
    });
    if (userError || !userData.user) return NextResponse.json({ success: false, error: userError?.message ?? "Unable to create supplier account." }, { status: 500 });

    const userId = userData.user.id;
    let businessId: string | null = null;
    let profileId: string | null = null;

    const rollback = async () => {
      if (profileId) await supabaseAdmin.from("service_profiles").delete().eq("id", profileId);
      if (businessId) await supabaseAdmin.from("supplier_accounts").delete().eq("business_id", businessId);
      if (businessId) await supabaseAdmin.from("businesses").delete().eq("id", businessId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
    };

    const { data: business, error: businessError } = await supabaseAdmin.from("businesses").insert({
      name: businessName,
      slug,
      business_type: category.name,
      city_id: cityId,
      phone: phone || null,
      email,
      supplier_contact_name: contactName,
      description: notes || null,
      owner_id: userId,
      claimed: true,
      verified: false,
      status: "pending",
    }).select("id").single();
    if (businessError || !business) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ success: false, error: businessError?.message ?? "Unable to create supplier business." }, { status: 500 });
    }
    businessId = business.id;

    const { data: profile, error: profileError } = await supabaseAdmin.from("service_profiles").insert({ business_id: business.id, category_id: category.id, status: "pending", booking_status: "closed" }).select("id").single();
    if (profileError || !profile) {
      await rollback();
      return NextResponse.json({ success: false, error: profileError?.message ?? "Unable to create supplier service profile." }, { status: 500 });
    }
    profileId = profile.id;

    const { error: accountError } = await supabaseAdmin.from("supplier_accounts").insert({ user_id: userId, business_id: business.id, contact_name: contactName });
    if (accountError) {
      await rollback();
      return NextResponse.json({ success: false, error: accountError.message }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.safariplug.com";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: `${appUrl}/supplier/onboarding` } });
    if (linkError || !linkData?.properties?.action_link) {
      await rollback();
      return NextResponse.json({ success: false, error: "The supplier invitation link could not be generated. No incomplete supplier account was left behind." }, { status: 502 });
    }

    if (!process.env.RESEND_API_KEY) {
      await rollback();
      return NextResponse.json({ success: false, error: "RESEND_API_KEY is not configured. No incomplete supplier account was left behind." }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
      to: email,
      subject: "Finish setting up your SafariPlug supplier account",
      text: `Hello ${contactName},\n\nSafariPlug has created a supplier account for ${businessName}. Finish your setup securely here:\n\n${linkData.properties.action_link}\n\nYou will create your own password and then complete your business profile, services, pricing, availability, and photos.\n\nIf you did not expect this invitation, you can ignore this email.`,
    });
    if (emailError) {
      await rollback();
      return NextResponse.json({ success: false, error: "The invitation email could not be sent. The incomplete supplier account was rolled back." }, { status: 502 });
    }

    return NextResponse.json({ success: true, supplierId: userId, businessId: business.id });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to invite supplier." }, { status: 500 });
  }
}
