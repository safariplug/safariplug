import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CURRENCIES = /^[A-Z]{3}$/;
const MAX_NAME = 160;
const MAX_DESCRIPTION = 2000;
const MAX_IMAGE_URL = 2048;
const RESTAURANT_SETTING_KEYS = [
  "ordering_enabled", "pickup_enabled", "safari_driver_enabled", "customer_driver_enabled",
  "restaurant_delivery_enabled", "minimum_order_amount", "free_delivery_threshold",
  "restaurant_delivery_fee", "safari_driver_base_fee", "safari_driver_per_km",
  "customer_driver_base_fee", "customer_driver_per_km", "preparation_time_minutes",
] as const;

async function getSupplierBusinessId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { user: null, businessId: null };
  const { data } = await supabaseAdmin.from("supplier_accounts").select("business_id").eq("user_id", user.id).maybeSingle();
  return { user, businessId: data?.business_id ?? null };
}

function text(value: unknown, max: number, field: string, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new Error(`${field} is required`);
  if (result.length > max) throw new Error(`${field} is too long`);
  return result || null;
}

function finiteNumber(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${field} must be a valid number`);
  return result;
}

function integer(value: unknown, field: string, min = 0, max = 1000000) {
  const result = Number(value ?? 0);
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`${field} must be a valid integer`);
  return result;
}

function settingValue(key: string, value: unknown) {
  if (["ordering_enabled", "pickup_enabled", "safari_driver_enabled", "customer_driver_enabled", "restaurant_delivery_enabled"].includes(key)) {
    if (typeof value !== "boolean") throw new Error(`${key} must be true or false`);
    return value;
  }
  if (key === "preparation_time_minutes") return integer(value, key, 1, 1440);
  return finiteNumber(value, key, 0, 100000000);
}

async function ownedMenuItem(itemId: string, businessId: string) {
  const { data } = await supabaseAdmin.from("restaurant_menu_items").select("id").eq("id", itemId).eq("business_id", businessId).maybeSingle();
  return data;
}

async function ownedOption(optionId: string, businessId: string) {
  const { data } = await supabaseAdmin.from("restaurant_menu_item_options").select("id,menu_item_id,restaurant_menu_items!inner(business_id)").eq("id", optionId).eq("restaurant_menu_items.business_id", businessId).maybeSingle();
  return data;
}

async function ownedValue(valueId: string, businessId: string) {
  const { data } = await supabaseAdmin.from("restaurant_menu_item_option_values").select("id,option_id,restaurant_menu_item_options!inner(menu_item_id,restaurant_menu_items!inner(business_id))").eq("id", valueId).eq("restaurant_menu_item_options.restaurant_menu_items.business_id", businessId).maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });

  const { user, businessId: ownedBusinessId } = await getSupplierBusinessId();
  const supplierView = Boolean(user && ownedBusinessId === businessId);
  const { data: settings, error: settingsError } = await supabaseAdmin.from("restaurant_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  const categoryQuery = supabaseAdmin.from("restaurant_menu_categories").select("*").eq("business_id", businessId).order("sort_order");
  const itemQuery = supabaseAdmin.from("restaurant_menu_items").select("*, restaurant_menu_item_options(*, restaurant_menu_item_option_values(*))").eq("business_id", businessId).order("sort_order");
  const [{ data: categories, error: categoryError }, { data: items, error: itemError }] = await Promise.all([
    supplierView ? categoryQuery : categoryQuery.eq("active", true),
    supplierView ? itemQuery : itemQuery.eq("active", true).eq("available", true),
  ]);
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  const activeCategoryIds = new Set((categories ?? []).filter((category: any) => category.active).map((category: any) => category.id));
  const visibleItems = supplierView ? (items ?? []) : (items ?? []).filter((item: any) => !item.category_id || activeCategoryIds.has(item.category_id));
  const publicSettings = settings ? {
    ordering_enabled: settings.ordering_enabled, pickup_enabled: settings.pickup_enabled,
    safari_driver_enabled: settings.safari_driver_enabled, customer_driver_enabled: settings.customer_driver_enabled,
    restaurant_delivery_enabled: settings.restaurant_delivery_enabled, minimum_order_amount: settings.minimum_order_amount,
    free_delivery_threshold: settings.free_delivery_threshold, restaurant_delivery_fee: settings.restaurant_delivery_fee,
    safari_driver_base_fee: settings.safari_driver_base_fee, safari_driver_per_km: settings.safari_driver_per_km,
    customer_driver_base_fee: settings.customer_driver_base_fee, customer_driver_per_km: settings.customer_driver_per_km,
    preparation_time_minutes: settings.preparation_time_minutes,
  } : null;
  return NextResponse.json({ settings: supplierView ? settings : publicSettings, categories: categories ?? [], items: visibleItems, supplierView });
}

export async function POST(request: Request) {
  const { user, businessId } = await getSupplierBusinessId();
  if (!user || !businessId) return NextResponse.json({ error: "Supplier authentication required" }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "settings") {
      if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) throw new Error("settings is required");
      const updates: Record<string, unknown> = { business_id: businessId };
      for (const key of RESTAURANT_SETTING_KEYS) if (Object.prototype.hasOwnProperty.call(body.settings, key)) updates[key] = settingValue(key, body.settings[key]);
      if (Object.keys(updates).length === 1) throw new Error("No supported restaurant settings supplied");
      const { error } = await supabaseAdmin.from("restaurant_settings").upsert(updates, { onConflict: "business_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "category") {
      const name = text(body.name, MAX_NAME, "Category name", true), description = text(body.description, MAX_DESCRIPTION, "Category description"), sortOrder = integer(body.sortOrder, "sortOrder");
      const { data, error } = await supabaseAdmin.from("restaurant_menu_categories").insert({ business_id: businessId, name, description, sort_order: sortOrder }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ category: data });
    }
    if (body.action === "item") {
      const name = text(body.name, MAX_NAME, "Item name", true), description = text(body.description, MAX_DESCRIPTION, "Item description"), imageUrl = text(body.imageUrl, MAX_IMAGE_URL, "Image URL");
      const price = finiteNumber(body.price, "Price", 0, 100000000), currency = String(body.currency ?? "KES").trim().toUpperCase();
      const preparationTimeMinutes = body.preparationTimeMinutes == null ? null : integer(body.preparationTimeMinutes, "preparationTimeMinutes", 1, 1440), sortOrder = integer(body.sortOrder, "sortOrder"), categoryId = body.categoryId ? String(body.categoryId) : null;
      if (!CURRENCIES.test(currency)) throw new Error("Currency must be a 3-letter ISO code");
      if (categoryId) { const { data: category } = await supabaseAdmin.from("restaurant_menu_categories").select("id").eq("id", categoryId).eq("business_id", businessId).maybeSingle(); if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 }); }
      const { data, error } = await supabaseAdmin.from("restaurant_menu_items").insert({ business_id: businessId, category_id: categoryId, name, description, image_url: imageUrl, price, currency, preparation_time_minutes: preparationTimeMinutes, sort_order: sortOrder }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ item: data });
    }
    if (body.action === "option") {
      const menuItemId = String(body.menuItemId ?? "").trim();
      if (!menuItemId || !(await ownedMenuItem(menuItemId, businessId))) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
      const name = text(body.name, MAX_NAME, "Option name", true), sortOrder = integer(body.sortOrder, "sortOrder");
      if (typeof body.required !== "undefined" && typeof body.required !== "boolean") throw new Error("required must be true or false");
      const { data, error } = await supabaseAdmin.from("restaurant_menu_item_options").insert({ menu_item_id: menuItemId, name, required: body.required === true, sort_order: sortOrder }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ option: data });
    }
    if (body.action === "option_value") {
      const optionId = String(body.optionId ?? "").trim();
      if (!optionId || !(await ownedOption(optionId, businessId))) return NextResponse.json({ error: "Menu option not found" }, { status: 404 });
      const name = text(body.name, MAX_NAME, "Option value name", true), priceDelta = finiteNumber(body.priceDelta ?? 0, "Price delta", -100000000, 100000000), sortOrder = integer(body.sortOrder, "sortOrder");
      const { data, error } = await supabaseAdmin.from("restaurant_menu_item_option_values").insert({ option_id: optionId, name, price_delta: priceDelta, sort_order: sortOrder }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ value: data });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid menu request" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const { user, businessId } = await getSupplierBusinessId();
  if (!user || !businessId) return NextResponse.json({ error: "Supplier authentication required" }, { status: 401 });
  try {
    const body = await request.json(); const id = String(body.id ?? "").trim(); const type = ["category", "item", "option", "option_value"].includes(body.type) ? body.type : null;
    if (!id || !type) return NextResponse.json({ error: "A valid menu type and id are required" }, { status: 400 });
    if (type === "category") {
      const name = text(body.name, MAX_NAME, "Category name", true), description = text(body.description, MAX_DESCRIPTION, "Category description"), sortOrder = integer(body.sortOrder, "sortOrder");
      const { data, error } = await supabaseAdmin.from("restaurant_menu_categories").update({ name, description, sort_order: sortOrder, active: body.active !== false }).eq("id", id).eq("business_id", businessId).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ data });
    }
    if (type === "option") {
      const owned = await ownedOption(id, businessId); if (!owned) return NextResponse.json({ error: "Menu option not found" }, { status: 404 });
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = text(body.name, MAX_NAME, "Option name", true);
      if (body.required !== undefined) { if (typeof body.required !== "boolean") throw new Error("required must be true or false"); updates.required = body.required; }
      if (body.sortOrder !== undefined) updates.sort_order = integer(body.sortOrder, "sortOrder");
      if (body.active !== undefined) { if (typeof body.active !== "boolean") throw new Error("active must be true or false"); updates.active = body.active; }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "No option changes supplied" }, { status: 400 });
      const { data, error } = await supabaseAdmin.from("restaurant_menu_item_options").update(updates).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ data });
    }
    if (type === "option_value") {
      const owned = await ownedValue(id, businessId); if (!owned) return NextResponse.json({ error: "Menu option value not found" }, { status: 404 });
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = text(body.name, MAX_NAME, "Option value name", true);
      if (body.priceDelta !== undefined) updates.price_delta = finiteNumber(body.priceDelta, "Price delta", -100000000, 100000000);
      if (body.sortOrder !== undefined) updates.sort_order = integer(body.sortOrder, "sortOrder");
      if (body.active !== undefined) { if (typeof body.active !== "boolean") throw new Error("active must be true or false"); updates.active = body.active; }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "No option value changes supplied" }, { status: 400 });
      const { data, error } = await supabaseAdmin.from("restaurant_menu_item_option_values").update(updates).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ data });
    }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = text(body.name, MAX_NAME, "Item name", true);
    if (body.description !== undefined) updates.description = text(body.description, MAX_DESCRIPTION, "Item description");
    if (body.imageUrl !== undefined) updates.image_url = text(body.imageUrl, MAX_IMAGE_URL, "Image URL");
    if (body.price !== undefined) updates.price = finiteNumber(body.price, "Price", 0, 100000000);
    if (body.preparationTimeMinutes !== undefined) updates.preparation_time_minutes = body.preparationTimeMinutes == null ? null : integer(body.preparationTimeMinutes, "preparationTimeMinutes", 1, 1440);
    if (body.sortOrder !== undefined) updates.sort_order = integer(body.sortOrder, "sortOrder");
    if (body.available !== undefined) { if (typeof body.available !== "boolean") throw new Error("available must be true or false"); updates.available = body.available; }
    if (body.active !== undefined) { if (typeof body.active !== "boolean") throw new Error("active must be true or false"); updates.active = body.active; }
    if (body.currency !== undefined) { const currency = String(body.currency).trim().toUpperCase(); if (!CURRENCIES.test(currency)) throw new Error("Currency must be a 3-letter ISO code"); updates.currency = currency; }
    if (body.categoryId !== undefined) { const categoryId = body.categoryId ? String(body.categoryId) : null; if (categoryId) { const { data: category } = await supabaseAdmin.from("restaurant_menu_categories").select("id").eq("id", categoryId).eq("business_id", businessId).maybeSingle(); if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 }); } updates.category_id = categoryId; }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No menu changes supplied" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("restaurant_menu_items").update(updates).eq("id", id).eq("business_id", businessId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid menu request" }, { status: 400 }); }
}
