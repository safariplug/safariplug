import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getSupplier() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin
    .from("supplier_accounts")
    .select("business_id,onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.business_id || !["approved", "live"].includes(data.onboarding_status)) return null;
  return { user, businessId: data.business_id };
}

export async function GET() {
  const supplier = await getSupplier();
  if (!supplier) return NextResponse.json({ error: "Supplier access required" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("food_orders")
    .select("*, food_order_items(*), food_delivery_assignments(*, driver_profiles(id,display_name), vehicles(id,make_model,registration_number))")
    .eq("business_id", supplier.businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    orders: data ?? [],
    canonicalStatusEndpoint: "/api/restaurants/orders/status",
  });
}

/**
 * This legacy supplier mutation endpoint intentionally does not update order
 * state anymore. Restaurant order transitions must go through the canonical
 * status endpoint, which enforces ownership, allowed state transitions,
 * payment-before-pickup/delivery, and real driver assignment eligibility.
 */
export async function PATCH() {
  const supplier = await getSupplier();
  if (!supplier) return NextResponse.json({ error: "Supplier access required" }, { status: 403 });

  return NextResponse.json(
    {
      error: "This restaurant order update endpoint has been retired. Use /api/restaurants/orders/status.",
      canonicalStatusEndpoint: "/api/restaurants/orders/status",
    },
    { status: 410 }
  );
}
