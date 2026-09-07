import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const METHODS = new Set(["pickup", "safari_driver", "customer_driver", "restaurant_delivery"]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to place a food order" }, { status: 401 });

  const body = await request.json();
  const { businessId, fulfillmentMethod, customerName, customerPhone, customerEmail, deliveryAddress, deliveryLatitude, deliveryLongitude, customerNotes, items, driverId } = body;
  if (!businessId || !METHODS.has(fulfillmentMethod) || !customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Restaurant, delivery method, contact details and at least one item are required" }, { status: 400 });
  }
  if (["safari_driver", "customer_driver", "restaurant_delivery"].includes(fulfillmentMethod) && !deliveryAddress) return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
  if (fulfillmentMethod === "customer_driver" && !driverId) return NextResponse.json({ error: "Choose a driver" }, { status: 400 });

  const { data: settings } = await supabaseAdmin.from("restaurant_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (!settings?.ordering_enabled) return NextResponse.json({ error: "Online ordering is not currently available" }, { status: 409 });
  if (fulfillmentMethod === "pickup" && !settings.pickup_enabled) return NextResponse.json({ error: "Pickup is unavailable" }, { status: 409 });
  if (fulfillmentMethod === "safari_driver" && !settings.safari_driver_enabled) return NextResponse.json({ error: "SafariPlug delivery is unavailable" }, { status: 409 });
  if (fulfillmentMethod === "customer_driver" && !settings.customer_driver_enabled) return NextResponse.json({ error: "Customer-selected drivers are unavailable" }, { status: 409 });
  if (fulfillmentMethod === "restaurant_delivery" && !settings.restaurant_delivery_enabled) return NextResponse.json({ error: "Restaurant delivery is unavailable" }, { status: 409 });

  let selectedDriver: { id: string } | null = null;
  if (driverId) {
    const { data: driver } = await supabaseAdmin.from("driver_profiles").select("id").eq("id", driverId).eq("service_status", "active").eq("verification_state", "verified").maybeSingle();
    if (!driver) return NextResponse.json({ error: "Selected driver is not available" }, { status: 409 });
    selectedDriver = driver;
  }

  const ids = items.map((item: any) => item.menuItemId).filter(Boolean);
  const { data: menuItems } = await supabaseAdmin.from("restaurant_menu_items").select("id,name,price,currency,available,active").eq("business_id", businessId).in("id", ids);
  const byId = new Map((menuItems ?? []).map((item) => [item.id, item]));
  let subtotal = 0;
  const normalized = [];
  for (const item of items) {
    const menu = byId.get(item.menuItemId);
    const quantity = Number(item.quantity);
    if (!menu || !menu.active || !menu.available || !Number.isInteger(quantity) || quantity < 1) return NextResponse.json({ error: "One or more menu items are unavailable" }, { status: 409 });
    const lineTotal = Number(menu.price) * quantity;
    subtotal += lineTotal;
    normalized.push({ menu_item_id: menu.id, item_name: menu.name, unit_price: menu.price, quantity, line_total: lineTotal, notes: item.notes ?? null });
  }
  if (subtotal < Number(settings.minimum_order_amount ?? 0)) return NextResponse.json({ error: `Minimum order is ${settings.minimum_order_amount} ${menuItems?.[0]?.currency ?? "KES"}` }, { status: 409 });

  let deliveryFee = 0;
  if (fulfillmentMethod === "restaurant_delivery") deliveryFee = subtotal >= Number(settings.free_delivery_threshold ?? Number.MAX_SAFE_INTEGER) ? 0 : Number(settings.restaurant_delivery_fee ?? 0);
  if (fulfillmentMethod === "safari_driver" || fulfillmentMethod === "customer_driver") {
    deliveryFee = Number(body.deliveryFee ?? 0);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) return NextResponse.json({ error: "Invalid delivery fee" }, { status: 400 });
  }
  const total = subtotal + deliveryFee;
  const { data: order, error } = await supabaseAdmin.from("food_orders").insert({ business_id: businessId, customer_user_id: user.id, customer_name: customerName, customer_phone: customerPhone, customer_email: customerEmail ?? user.email ?? null, fulfillment_method: fulfillmentMethod, payment_status: "unpaid", currency: menuItems?.[0]?.currency ?? "KES", subtotal, delivery_fee: deliveryFee, customer_total: total, pickup_address: fulfillmentMethod === "pickup" ? deliveryAddress ?? null : null, delivery_address: fulfillmentMethod === "pickup" ? null : deliveryAddress, delivery_latitude: deliveryLatitude ?? null, delivery_longitude: deliveryLongitude ?? null, customer_notes: customerNotes ?? null }).select().single();
  if (error || !order) return NextResponse.json({ error: error?.message ?? "Unable to create order" }, { status: 400 });
  const { error: itemsError } = await supabaseAdmin.from("food_order_items").insert(normalized.map((item) => ({ ...item, order_id: order.id })));
  if (itemsError) { await supabaseAdmin.from("food_orders").delete().eq("id", order.id); return NextResponse.json({ error: itemsError.message }, { status: 400 }); }

  if (selectedDriver) {
    const { error: assignmentError } = await supabaseAdmin.from("food_delivery_assignments").insert({ order_id: order.id, driver_id: selectedDriver.id, assignment_source: fulfillmentMethod === "customer_driver" ? "customer" : "safariplug", status: "assigned", delivery_fee: deliveryFee });
    if (assignmentError) { await supabaseAdmin.from("food_order_items").delete().eq("order_id", order.id); await supabaseAdmin.from("food_orders").delete().eq("id", order.id); return NextResponse.json({ error: "Unable to assign delivery driver" }, { status: 400 }); }
  }
  return NextResponse.json({ order });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("food_orders").select("*, food_order_items(*), food_delivery_assignments(*)").eq("customer_user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}
