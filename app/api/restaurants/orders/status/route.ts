import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["driver_assigned", "picked_up", "cancelled"],
  driver_assigned: ["picked_up", "cancelled"],
  picked_up: ["on_the_way", "delivered"],
  on_the_way: ["delivered"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

const DRIVER_TRANSITIONS: Record<string, string[]> = {
  assigned: ["accepted", "declined", "cancelled"],
  accepted: ["arrived_at_restaurant", "cancelled"],
  arrived_at_restaurant: ["picked_up", "cancelled"],
  picked_up: ["on_the_way", "delivered", "cancelled"],
  on_the_way: ["delivered", "cancelled"],
  delivered: [],
  declined: [],
  cancelled: [],
};

async function user() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

async function supplierBusinessId(userId: string) {
  const { data } = await supabaseAdmin.from("supplier_accounts").select("business_id").eq("user_id", userId).maybeSingle();
  return data?.business_id ?? null;
}

export async function GET(request: Request) {
  const currentUser = await user();
  if (!currentUser) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const businessId = searchParams.get("businessId");

  let query = supabaseAdmin
    .from("food_orders")
    .select("*, food_order_items(*), food_delivery_assignments(*), businesses:business_id(id,name)")
    .order("created_at", { ascending: false });

  if (orderId) query = query.eq("id", orderId);
  else if (businessId) {
    const ownedBusinessId = await supplierBusinessId(currentUser.id);
    if (!ownedBusinessId || ownedBusinessId !== businessId) return NextResponse.json({ error: "Supplier access denied" }, { status: 403 });
    query = query.eq("business_id", businessId).limit(100);
  } else {
    query = query.eq("customer_user_id", currentUser.id).limit(50);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (orderId && !data?.length) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (orderId) {
    const order = data?.[0];
    const ownsOrder = order.customer_user_id === currentUser.id;
    const ownedBusinessId = await supplierBusinessId(currentUser.id);
    const isSupplier = ownedBusinessId === order.business_id;
    const assignment = order.food_delivery_assignments?.find((a: { driver_id?: string }) => a.driver_id === currentUser.id);
    if (!ownsOrder && !isSupplier && !assignment) return NextResponse.json({ error: "Order access denied" }, { status: 403 });
  }

  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  const currentUser = await user();
  if (!currentUser) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json();
  const { orderId, status, note, assignmentStatus, rating, customerNote } = body;
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const { data: order, error: orderError } = await supabaseAdmin.from("food_orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const ownedBusinessId = await supplierBusinessId(currentUser.id);
  const isSupplier = ownedBusinessId === order.business_id;
  const isCustomer = order.customer_user_id === currentUser.id;
  const { data: assignment } = await supabaseAdmin.from("food_delivery_assignments").select("*").eq("order_id", orderId).eq("driver_id", currentUser.id).maybeSingle();
  const isDriver = Boolean(assignment);

  if (status) {
    if (!isSupplier && !isCustomer && !isDriver) return NextResponse.json({ error: "Order access denied" }, { status: 403 });
    if (isCustomer && !isSupplier && !isDriver && status !== "cancelled") return NextResponse.json({ error: "Customers can only cancel an order" }, { status: 403 });
    if (isDriver && !isSupplier && !["picked_up", "on_the_way", "delivered"].includes(status)) return NextResponse.json({ error: "Driver cannot make this order transition" }, { status: 403 });
    if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(status)) return NextResponse.json({ error: `Cannot move order from ${order.status} to ${status}` }, { status: 409 });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status, updated_at: now };
    if (status === "accepted") { update.accepted_at = now; update.accepted_by = currentUser.id; }
    if (status === "ready") update.ready_at = now;
    if (status === "picked_up") update.picked_up_at = now;
    if (status === "delivered") update.delivered_at = now;
    if (status === "cancelled" || status === "rejected") { update.cancelled_at = now; update.cancellation_reason = note ?? null; }
    if (status === "driver_assigned") update.updated_at = now;

    const { data: updated, error } = await supabaseAdmin.from("food_orders").update(update).eq("id", orderId).eq("status", order.status).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ order: updated });
  }

  if (assignmentStatus) {
    if (!isDriver && !isSupplier) return NextResponse.json({ error: "Driver access denied" }, { status: 403 });
    if (!assignment) return NextResponse.json({ error: "Delivery assignment not found" }, { status: 404 });
    if (!(DRIVER_TRANSITIONS[assignment.status] ?? []).includes(assignmentStatus)) return NextResponse.json({ error: `Cannot move delivery from ${assignment.status} to ${assignmentStatus}` }, { status: 409 });
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status: assignmentStatus, updated_at: now };
    if (assignmentStatus === "accepted") update.accepted_at = now;
    if (assignmentStatus === "picked_up") update.picked_up_at = now;
    if (assignmentStatus === "delivered") update.delivered_at = now;
    if (assignmentStatus === "arrived_at_restaurant") update.arrived_at = now;
    const { data: updated, error } = await supabaseAdmin.from("food_delivery_assignments").update(update).eq("id", assignment.id).eq("status", assignment.status).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: updated });
  }

  if (rating !== undefined || customerNote !== undefined) {
    if (!isCustomer || order.status !== "delivered") return NextResponse.json({ error: "Only the customer can rate a delivered order" }, { status: 403 });
    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    const { data: updated, error } = await supabaseAdmin.from("food_delivery_assignments").update({ customer_rating: score, customer_note: customerNote ?? null }).eq("order_id", orderId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: updated });
  }

  return NextResponse.json({ error: "No supported update supplied" }, { status: 400 });
}
