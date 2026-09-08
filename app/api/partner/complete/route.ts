import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Please confirm your email and sign in again." }, { status: 401 });

  const metadata = user.user_metadata ?? {};
  if (metadata.account_type !== "supplier") {
    return NextResponse.json({ error: "This account is not a business partner account." }, { status: 403 });
  }

  const { data: existingAccount, error: accountLookupError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (accountLookupError) return NextResponse.json({ error: accountLookupError.message }, { status: 500 });
  if (existingAccount) return NextResponse.json({ success: true, businessId: existingAccount.business_id, onboardingStatus: existingAccount.onboarding_status });

  const fullName = String(metadata.full_name || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(metadata.phone || "").trim();
  const businessName = String(metadata.business_name || "").trim();
  const businessType = String(metadata.business_type || "").trim();
  if (!fullName || !email || !businessName || !businessType) {
    return NextResponse.json({ error: "Partner registration details are incomplete. Please start registration again." }, { status: 422 });
  }

  const baseSlug = slugify(businessName) || `partner-${user.id.slice(0, 8)}`;
  let slug = baseSlug;
  for (let i = 2; i <= 100; i++) {
    const { data: taken } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
    if (!taken || taken.id) {
      if (!taken) break;
      slug = `${baseSlug}-${i}`;
    }
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    email,
    phone: phone || null,
    user_type: "partner",
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { data: business, error: businessError } = await supabaseAdmin.from("businesses").insert({
    owner_id: user.id,
    name: businessName,
    slug,
    business_type: businessType,
    phone: phone || null,
    whatsapp: phone || null,
    email,
    status: "INACTIVE",
    verified: false,
    claimed: true,
  }).select("id").single();
  if (businessError || !business) return NextResponse.json({ error: businessError?.message || "Unable to create business." }, { status: 500 });

  const { data: category } = await supabaseAdmin
    .from("service_categories")
    .select("id")
    .eq("name", businessType)
    .eq("status", "active")
    .maybeSingle();

  if (category) {
    const { error: serviceProfileError } = await supabaseAdmin.from("service_profiles").insert({
      business_id: business.id,
      category_id: category.id,
      status: "pending",
      booking_status: "closed",
    });
    if (serviceProfileError) {
      await supabaseAdmin.from("businesses").delete().eq("id", business.id);
      return NextResponse.json({ error: serviceProfileError.message }, { status: 500 });
    }
  }

  const { error: supplierError } = await supabaseAdmin.from("supplier_accounts").insert({
    user_id: user.id,
    business_id: business.id,
    contact_name: fullName,
    invitation_status: "accepted",
    onboarding_status: "draft",
    accepted_at: new Date().toISOString(),
  });
  if (supplierError) {
    await supabaseAdmin.from("service_profiles").delete().eq("business_id", business.id);
    await supabaseAdmin.from("businesses").delete().eq("id", business.id);
    return NextResponse.json({ error: supplierError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, businessId: business.id, onboardingStatus: "draft" });
}
