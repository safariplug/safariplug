import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const b = await request.json();
    for (const k of ["serviceProfileId", "offeringId", "staffId", "customerName", "startsAt"]) if (!b[k]) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    if (!b.customerEmail && !b.customerPhone) return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });

    let customerUserId: string | null = null;
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (request.headers.get("x-safariplug-concierge") === "1") {
      if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
        return NextResponse.json({ error: "A verified SafariPlug client account is required for Concierge bookings." }, { status: 401 });
      }
      customerUserId = user.id;
    } else if (user && !user.is_anonymous && (user.email_confirmed_at || user.phone_confirmed_at)) {
      // Public storefront bookings remain available to guests, but confirmed
      // SafariPlug clients get the appointment attached to their account so it
      // appears in My Bookings and can be managed there.
      customerUserId = user.id;
    }

    const { data: appointment, error } = await supabaseAdmin.rpc("create_service_appointment", {
      p_service_profile_id: b.serviceProfileId,
      p_offering_id: b.offeringId,
      p_staff_id: b.staffId,
      p_customer_user_id: customerUserId,
      p_customer_name: b.customerName,
      p_customer_email: b.customerEmail ?? null,
      p_customer_phone: b.customerPhone ?? null,
      p_starts_at: b.startsAt,
      p_customer_notes: b.customerNotes ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("slot_unavailable") ? 409 : 400 });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
