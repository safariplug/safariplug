import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentCompliance, driverVerificationCurrent } from "@/lib/services/driver-verification";

const ACTIVE_ASSIGNMENT_STATUSES=["assigned","accepted","arrived_at_restaurant","picked_up","on_the_way"];

async function getUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data.user && !data.user.is_anonymous && (data.user.email_confirmed_at || data.user.phone_confirmed_at)) {
      return data.user;
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: drivers, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,service_city,service_country,preferred,capabilities,personal_photo_url,identity_liveness_verified_at,driving_license_compliance_status,service_status,verification_state")
    .eq("service_status", "active")
    .eq("verification_state", "verified")
    .order("preferred", { ascending: false })
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eligible = [];
  for (const driver of drivers ?? []) {
    if (!driver.personal_photo_url) continue;
    if (!(await driverVerificationCurrent(driver))) continue;
    if (!currentCompliance(driver.driving_license_compliance_status)) continue;

    const { data: vehicles, error: vehicleError } = await supabaseAdmin
      .from("vehicles")
      .select("id,status,registration_compliance_status,insurance_compliance_status")
      .eq("driver_id", driver.id);
    if (vehicleError) continue;

    const compliantVehicle = (vehicles ?? []).find(vehicle =>
      vehicle.status === "active" &&
      currentCompliance(vehicle.registration_compliance_status) &&
      currentCompliance(vehicle.insurance_compliance_status)
    );
    if (!compliantVehicle) continue;

    const { data: busy } = await supabaseAdmin
      .from("food_delivery_assignments")
      .select("id")
      .eq("driver_id", driver.id)
      .in("status", ACTIVE_ASSIGNMENT_STATUSES)
      .limit(1)
      .maybeSingle();
    if (busy) continue;

    eligible.push({
      id: driver.id,
      display_name: driver.display_name,
      service_city: driver.service_city,
      service_country: driver.service_country,
      preferred: driver.preferred,
      capabilities: driver.capabilities,
    });
  }

  return NextResponse.json({ drivers: eligible });
}
