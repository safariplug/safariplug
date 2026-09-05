"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

const capabilities = new Set(["airport_transfer", "hotel_transfer", "long_distance", "city_transfer", "child_seat", "wheelchair_accessible", "large_luggage", "premium_vehicle"]);
const providerTypes = new Set(["independent_driver", "safariplug_driver", "transport_company", "hotel_driver", "tour_operator"]);
const licenseTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function submitDriverApplication(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("service_city") ?? "").trim();
  const country = String(formData.get("service_country") ?? "Kenya").trim();
  const airport = String(formData.get("service_airport_code") ?? "").trim().toUpperCase();
  const providerType = String(formData.get("provider_type") ?? "independent_driver");
  const vehicleCategory = String(formData.get("vehicle_category") ?? "").trim();
  const vehicleModel = String(formData.get("vehicle_make_model") ?? "").trim();
  const passengers = Number(formData.get("passenger_capacity") ?? 0);
  const luggage = Number(formData.get("luggage_capacity") ?? 0);
  const availableOn = String(formData.get("available_on") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const license = formData.get("driving_license");
  const selectedCapabilities = formData.getAll("capability").map(String).filter((value) => capabilities.has(value));

  if (!email || !password || password.length < 8 || !fullName || !phone || !city) redirect("/driver/signup?error=Please%20complete%20the%20required%20fields%20and%20use%20an%208%2B%20character%20password.");
  if (!providerTypes.has(providerType)) redirect("/driver/signup?error=Invalid%20driver%20provider%20type.");
  if (!vehicleCategory || !vehicleModel || !Number.isInteger(passengers) || passengers < 1) redirect("/driver/signup?error=Please%20provide%20your%20vehicle%20type%2C%20make%2Fmodel%20and%20passenger%20capacity.");
  if (!(license instanceof File) || license.size < 1 || license.size > 8 * 1024 * 1024 || !licenseTypes.has(license.type)) redirect("/driver/signup?error=Please%20upload%20a%20valid%20driving%20license%20image%20or%20PDF%20(max%208MB).");

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: fullName, phone, account_type: "driver" } });
  if (authError || !authData.user) redirect(`/driver/signup?error=${encodeURIComponent(authError?.message ?? "Unable to create account.")}`);

  const userId = authData.user.id;
  let driverId: string | null = null;
  let licensePath: string | null = null;
  try {
    const { data: driver, error: driverError } = await supabaseAdmin.from("driver_profiles").insert({ user_id: userId, display_name: fullName, provider_type: providerType, contact_ref: phone, service_status: "pending", verification_state: "unverified", capabilities: selectedCapabilities, service_country: country || null, service_city: city, service_airport_code: airport || null, source: "safariplug" }).select("id").single();
    if (driverError || !driver) throw new Error(driverError?.message ?? "Unable to create driver application.");
    driverId = driver.id;

    const extension = license.name.includes(".") ? license.name.split(".").pop()!.toLowerCase() : "bin";
    licensePath = `${driver.id}/driving-license-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("driver-verification").upload(licensePath, license, { contentType: license.type, upsert: false });
    if (uploadError) throw new Error(`Unable to securely store driving license: ${uploadError.message}`);
    const { error: licenseUpdateError } = await supabaseAdmin.from("driver_profiles").update({ driving_license_path: licensePath, driving_license_uploaded_at: new Date().toISOString() }).eq("id", driver.id);
    if (licenseUpdateError) throw new Error(licenseUpdateError.message);

    const { error: vehicleError } = await supabaseAdmin.from("vehicles").insert({ driver_id: driver.id, category: vehicleCategory, make_model: vehicleModel, passenger_capacity: passengers, luggage_capacity: Number.isInteger(luggage) && luggage >= 0 ? luggage : null, accessibility: selectedCapabilities.includes("wheelchair_accessible"), status: "draft" });
    if (vehicleError) throw new Error(vehicleError.message);
    if (availableOn) {
      const { error: availabilityError } = await supabaseAdmin.from("driver_availability").insert({ driver_id: driver.id, available_on: availableOn, start_time: startTime || null, end_time: endTime || null, timezone: "Africa/Nairobi", status: "available" });
      if (availabilityError) throw new Error(availabilityError.message);
    }
    const { error: verificationError } = await supabaseAdmin.from("verification_cases").insert({ subject_type: "driver", subject_id: driver.id, status: "not_started", verification_level: "enhanced", provider: "human_review", notes: "Driver onboarding submitted. Live face/liveness verification is mandatory before approval and booking eligibility." });
    if (verificationError) throw new Error(verificationError.message);
  } catch (error) {
    if (licensePath) await supabaseAdmin.storage.from("driver-verification").remove([licensePath]);
    await supabaseAdmin.auth.admin.deleteUser(userId, true);
    const message = error instanceof Error ? error.message : "Unable to submit application.";
    redirect(`/driver/signup?error=${encodeURIComponent(message)}`);
  }
  redirect(`/driver/application?submitted=1&driver=${encodeURIComponent(driverId ?? "")}`);
}
