import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifiedServiceProviderUserIds } from "@/lib/services/provider-bookability";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("service_profiles")
    .select("id,timezone,businesses!inner(id,name,slug,description,city_id,owner_id),service_categories!inner(name,slug),service_offerings!inner(id,name,description,duration_minutes,price,currency,requires_confirmation,status)")
    .eq("status", "active")
    .eq("booking_status", "open")
    .in("businesses.status", ["active", "ACTIVE"])
    .eq("service_categories.status", "active")
    .eq("service_offerings.status", "active")
    .order("id");
  if (error) return NextResponse.json({ success: false, error: { code: "services_query_failed", message: error.message } }, { status: 500 });
  const rows = data ?? [];
  const verifiedOwners = await verifiedServiceProviderUserIds(rows.map((row:any)=>row.businesses?.owner_id));
  const publicRows = rows.filter((row:any)=>verifiedOwners.has(String(row.businesses?.owner_id||""))).map((row:any)=>({ ...row, businesses: row.businesses ? { id:row.businesses.id,name:row.businesses.name,slug:row.businesses.slug,description:row.businesses.description,city_id:row.businesses.city_id } : row.businesses }));
  return NextResponse.json({ success: true, data: publicRows });
}
