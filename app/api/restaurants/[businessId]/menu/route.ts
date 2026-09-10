import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });

  const [{ data: settings }, { data: categories, error: categoriesError }] = await Promise.all([
    supabaseAdmin.from("restaurant_settings").select("ordering_enabled,pickup_enabled,safari_driver_enabled,customer_driver_enabled,restaurant_delivery_enabled,restaurant_delivery_fee,free_delivery_threshold,minimum_order_amount,preparation_time_minutes,ordering_notice_minutes,timezone").eq("business_id", businessId).maybeSingle(),
    supabaseAdmin.from("restaurant_menu_categories").select("id,name,description,sort_order,active,restaurant_menu_items(id,name,description,image_url,price,currency,preparation_time_minutes,sort_order,available,active,restaurant_menu_item_options(id,name,required,sort_order,active,restaurant_menu_item_option_values(id,name,price_delta,sort_order,active)))").eq("business_id", businessId).eq("active", true).order("sort_order")
  ]);

  if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 });
  const normalized = (categories ?? []).map((category: any) => ({
    ...category,
    items: (category.restaurant_menu_items ?? []).filter((item: any) => item.active && item.available).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => ({
      ...item,
      restaurant_menu_item_options: (item.restaurant_menu_item_options ?? []).filter((option: any) => option.active).sort((a: any, b: any) => a.sort_order - b.sort_order).map((option: any) => ({
        ...option,
        restaurant_menu_item_option_values: (option.restaurant_menu_item_option_values ?? []).filter((value: any) => value.active).sort((a: any, b: any) => a.sort_order - b.sort_order)
      }))
    }))
  }));
  return NextResponse.json({ settings, categories: normalized });
}
