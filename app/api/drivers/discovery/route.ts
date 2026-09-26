import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentVerifiedDriverIds } from "@/lib/services/driver-verification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { data: drivers, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,personal_photo_url,identity_liveness_verified_at,service_city,service_country,capabilities,preferred,driving_license_compliance_status,vehicles(id,category,make_model,passenger_capacity,luggage_capacity,status,registration_compliance_status,insurance_compliance_status),driver_transfer_rates(id,rate_type,origin_label,destination_label,airport_code,amount,currency,status)")
    .eq("service_status","active")
    .eq("verification_state","verified")
    .in("driving_license_compliance_status",["valid","expiring_soon"])
    .order("preferred",{ascending:false})
    .order("display_name");

  if (error) return NextResponse.json({ error: "Unable to load verified drivers." }, { status: 500 });

  const trustedDriverIds = await currentVerifiedDriverIds(drivers ?? []);
  const eligible = (drivers ?? [])
    .filter((driver:any)=>trustedDriverIds.has(driver.id))
    .map((driver:any)=>({
      ...driver,
      vehicles:(driver.vehicles??[]).filter((vehicle:any)=>
        vehicle.status==="active" &&
        ["valid","expiring_soon"].includes(vehicle.registration_compliance_status) &&
        ["valid","expiring_soon"].includes(vehicle.insurance_compliance_status)
      ),
      driver_transfer_rates:(driver.driver_transfer_rates??[]).filter((rate:any)=>rate.status==="active"),
    }))
    .filter((driver:any)=>driver.vehicles.length>0&&Boolean(driver.personal_photo_url));

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (id) {
    const driver = eligible.find((row:any)=>row.id===id) || null;
    if (!driver) return NextResponse.json({ error: "Verified driver not found." }, { status: 404 });
    return NextResponse.json({ driver });
  }
  return NextResponse.json({ drivers: eligible });
}
