import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ACTIVE_DELIVERY_STATUSES = ["assigned", "accepted", "arrived_at_restaurant", "picked_up", "on_the_way"];

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // food_delivery_assignments.driver_id references driver_profiles.id, not auth.users.id.
  const { data: driver, error: driverError } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,service_status,verification_state")
    .eq("user_id", user.id)
    .maybeSingle();
  if (driverError) return NextResponse.json({ error: driverError.message }, { status: 500 });
  if (!driver) return NextResponse.json({ deliveries: [] });

  const { data: assignments, error: assignmentError } = await supabaseAdmin
    .from("food_delivery_assignments")
    .select("*")
    .eq("driver_id", driver.id)
    .in("status", ACTIVE_DELIVERY_STATUSES)
    .order("created_at", { ascending: false });

  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  if (!assignments?.length) return NextResponse.json({ deliveries: [] });

  const orderIds = assignments.map((a) => a.order_id);
  const { data: orders, error: orderError } = await supabaseAdmin
    .from("food_orders")
    .select("*, food_order_items(*), businesses:business_id(id,name)")
    .in("id", orderIds)
    .order("created_at", { ascending: false });

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
  return NextResponse.json({
    deliveries: assignments.map((assignment) => ({ assignment, order: orderMap.get(assignment.order_id) ?? null })),
  });
}
