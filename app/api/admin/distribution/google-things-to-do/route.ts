import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { googleTtdReadiness } from "@/lib/distribution/google-things-to-do-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from("service_profiles")
      .select("id,status,booking_status,businesses!inner(id,name,slug,description,address,latitude,longitude,phone,status),service_categories(name),service_offerings!inner(id,name,description,duration_minutes,price,currency,status)")
      .limit(2000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const candidates = (data || []).flatMap((profile: any) => {
      const business = profile.businesses;
      const category = profile.service_categories?.name || "";
      const offerings = Array.isArray(profile.service_offerings) ? profile.service_offerings : profile.service_offerings ? [profile.service_offerings] : [];
      return offerings.map((offering: any) => googleTtdReadiness({
        profileId: String(profile.id),
        offeringId: String(offering.id),
        category: String(category),
        businessName: String(business?.name || ""),
        businessSlug: business?.slug || null,
        description: business?.description || null,
        address: business?.address || null,
        latitude: business?.latitude == null ? null : Number(business.latitude),
        longitude: business?.longitude == null ? null : Number(business.longitude),
        phone: business?.phone || null,
        offeringName: String(offering.name || ""),
        offeringDescription: offering.description || null,
        durationMinutes: offering.duration_minutes == null ? null : Number(offering.duration_minutes),
        price: offering.price == null ? null : Number(offering.price),
        currency: offering.currency || null,
        businessStatus: business?.status || null,
        profileStatus: profile.status || null,
        bookingStatus: profile.booking_status || null,
        offeringStatus: offering.status || null,
      }));
    });

    const eligible = candidates.filter((item) => item.eligible);
    const blocked = candidates.filter((item) => !item.eligible);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      mode: "preflight",
      note: "Internal SafariPlug readiness manifest. Not a certified or submission-ready Google Actions Center feed.",
      counts: { total: candidates.length, eligible: eligible.length, blocked: blocked.length },
      eligible,
      blocked,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to build Google Things to do readiness manifest." }, { status: 500 });
  }
}
