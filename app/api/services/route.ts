import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifiedServiceProviderUserIds } from "@/lib/services/provider-bookability";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await supabaseAdmin.from("service_profiles").select("id,business_id,timezone,businesses!inner(id,name,slug,description,city_id,owner_id),service_categories(name),service_offerings(id,name,slug,description,duration_minutes,price,currency,requires_confirmation)").eq("status","active").eq("booking_status","open").in("businesses.status",["active","ACTIVE"]).eq("service_offerings.status","active");
  if (error) return NextResponse.json({ error: "Unable to load services" }, { status: 500 });
  const rows = data ?? [];
  const verifiedOwners = await verifiedServiceProviderUserIds(rows.map((row:any)=>row.businesses?.owner_id));
  const services = rows.filter((row:any)=>verifiedOwners.has(String(row.businesses?.owner_id||""))).map((row:any)=>({ ...row, businesses: row.businesses ? { id:row.businesses.id,name:row.businesses.name,slug:row.businesses.slug,description:row.businesses.description,city_id:row.businesses.city_id } : row.businesses }));
  return NextResponse.json({ services });
}
