import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const STATUSES = new Set(["accepted", "preparing", "ready", "driver_assigned", "picked_up", "on_the_way", "delivered", "cancelled", "rejected"]);

async function getSupplier() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from("supplier_accounts").select("business_id,onboarding_status").eq("user_id", user.id).maybeSingle();
  if (!data?.business_id || !["approved", "live"].includes(data.onboarding_status)) return null;
  return { user, businessId: data.business_id };
}

export async function GET() {
  const supplier = await getSupplier();
  if (!supplier) return NextResponse.json({ error: "Supplier access required" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("food_orders").select("*, food_order_items(*), food_delivery_assignments(*, driver_profiles(id,display_name), vehicles(id,make_model,registration_number))").eq("business_id", supplier.businessId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  const supplier = await getSupplier();
  if (!supplier) return NextResponse.json({ error: "Supplier access required" }, { status: 403 });
  const body = await request.json();
  const { orderId, status, restaurantNotes } = body;
  if (!orderId || (status && !STATUSES.has(status))) return NextResponse.json({ error: "Invalid order update" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (restaurantNotes !== undefined) updates.restaurant_notes = restaurantNotes;
  const timestamp: Record<string, string> = { accepted: "accepted_at", preparing: "accepted_at", ready: "ready_at", picked_up: "picked_up_at", on_the_way: "picked_up_at", delivered: "delivered_at", cancelled: "cancelled_at" };
  if (status && timestamp[status]) updates[timestamp[status]] = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("food_orders").update(updates).eq("id", orderId).eq("business_id", supplier.businessId).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 400 });
  return NextResponse.json({ order: data });
}
