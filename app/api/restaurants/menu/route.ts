import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getSupplierBusinessId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, businessId: null };
  const { data } = await supabaseAdmin.from("supplier_accounts").select("business_id").eq("user_id", user.id).maybeSingle();
  return { user, businessId: data?.business_id ?? null };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  const { data: settings } = await supabaseAdmin.from("restaurant_settings").select("*").eq("business_id", businessId).maybeSingle();
  const { data: categories, error: categoryError } = await supabaseAdmin.from("restaurant_menu_categories").select("*").eq("business_id", businessId).order("sort_order");
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
  const { data: items, error: itemError } = await supabaseAdmin.from("restaurant_menu_items").select("*, restaurant_menu_item_options(*, restaurant_menu_item_option_values(*))").eq("business_id", businessId).order("sort_order");
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  return NextResponse.json({ settings, categories: categories ?? [], items: items ?? [] });
}

export async function POST(request: Request) {
  const { user, businessId } = await getSupplierBusinessId();
  if (!user || !businessId) return NextResponse.json({ error: "Supplier authentication required" }, { status: 401 });
  const body = await request.json();
  const action = body.action;
  if (action === "settings") {
    const { error } = await supabaseAdmin.from("restaurant_settings").upsert({ business_id: businessId, ...body.settings }, { onConflict: "business_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "category") {
    const { data, error } = await supabaseAdmin.from("restaurant_menu_categories").insert({ business_id: businessId, name: body.name, description: body.description ?? null, sort_order: body.sortOrder ?? 0 }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ category: data });
  }
  if (action === "item") {
    const { data, error } = await supabaseAdmin.from("restaurant_menu_items").insert({ business_id: businessId, category_id: body.categoryId ?? null, name: body.name, description: body.description ?? null, image_url: body.imageUrl ?? null, price: body.price, currency: body.currency ?? "KES", preparation_time_minutes: body.preparationTimeMinutes ?? null, sort_order: body.sortOrder ?? 0 }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const { user, businessId } = await getSupplierBusinessId();
  if (!user || !businessId) return NextResponse.json({ error: "Supplier authentication required" }, { status: 401 });
  const body = await request.json();
  const table = body.type === "category" ? "restaurant_menu_categories" : "restaurant_menu_items";
  const allowed = body.type === "category" ? { name: body.name, description: body.description, sort_order: body.sortOrder, active: body.active } : { category_id: body.categoryId, name: body.name, description: body.description, image_url: body.imageUrl, price: body.price, preparation_time_minutes: body.preparationTimeMinutes, sort_order: body.sortOrder, available: body.available, active: body.active };
  const { data, error } = await supabaseAdmin.from(table).update(allowed).eq("id", body.id).eq("business_id", businessId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
