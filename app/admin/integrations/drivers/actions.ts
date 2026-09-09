"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createAvailabilityAdmin,
  createDriverAdmin,
  createVehicleAdmin,
  updateDriverAdmin,
  updateVehicleAdmin,
} from "@/lib/services/driver-admin";
import type { DriverCapability, DriverProviderType } from "@/lib/integrations/drivers/types";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

export async function createDriver(formData: FormData) {
  await requireAdmin();
  await createDriverAdmin({
    display_name: text(formData, "display_name"),
    provider_type: (text(formData, "provider_type") || "independent_driver") as DriverProviderType,
    contact_ref: nullableText(formData, "contact_ref"),
    service_city: nullableText(formData, "service_city"),
    service_country: nullableText(formData, "service_country"),
    service_airport_code: nullableText(formData, "service_airport_code"),
    capabilities: formData.getAll("capability") as DriverCapability[],
  });
  revalidatePath("/admin/integrations/drivers");
}

export async function updateDriverStatus(formData: FormData) {
  await requireAdmin();
  const driverId = text(formData, "driver_id");
  const serviceStatus = text(formData, "service_status") as "pending" | "active" | "inactive" | "suspended" | "off_duty";
  if (!driverId) throw new Error("Driver ID is required.");
  if (!["pending", "active", "inactive", "suspended", "off_duty"].includes(serviceStatus)) throw new Error("Invalid driver status.");

  if (serviceStatus === "active") {
    const { data: driver, error: driverError } = await supabaseAdmin
      .from("driver_profiles")
      .select("id,verification_state,driving_license_compliance_status")
      .eq("id", driverId)
      .maybeSingle();
    if (driverError || !driver) throw new Error("Driver could not be loaded.");
    if (driver.verification_state !== "verified") throw new Error("A driver must have verified identity before becoming active.");
    if (driver.driving_license_compliance_status !== "compliant") throw new Error("The driving license must be compliant before the driver can become active.");

    const { data: vehicles, error: vehicleError } = await supabaseAdmin
      .from("vehicles")
      .select("id,status,registration_compliance_status,insurance_compliance_status")
      .eq("driver_id", driverId);
    if (vehicleError) throw new Error("Driver vehicles could not be loaded.");
    const eligibleVehicle = (vehicles ?? []).some((vehicle) =>
      vehicle.status === "active" &&
      vehicle.registration_compliance_status === "compliant" &&
      vehicle.insurance_compliance_status === "compliant",
    );
    if (!eligibleVehicle) throw new Error("The driver needs an active vehicle with compliant registration and insurance before becoming active.");
  }

  await updateDriverAdmin(driverId, { service_status: serviceStatus });
  revalidatePath("/admin/integrations/drivers");
  revalidatePath("/driver/application");
}

export async function createVehicle(formData: FormData) {
  await requireAdmin();
  await createVehicleAdmin({
    driver_id: text(formData, "driver_id"),
    category: nullableText(formData, "category"),
    make_model: nullableText(formData, "make_model"),
    passenger_capacity: Number(text(formData, "passenger_capacity")) || null,
    luggage_capacity: Number(text(formData, "luggage_capacity")) || null,
    status: "draft",
  });
  revalidatePath("/admin/integrations/drivers");
}

export async function activateVehicle(formData: FormData) {
  await requireAdmin();
  await updateVehicleAdmin(text(formData, "vehicle_id"), { status: "active" });
  revalidatePath("/admin/integrations/drivers");
}

export async function createAvailability(formData: FormData) {
  await requireAdmin();
  await createAvailabilityAdmin({
    driver_id: text(formData, "driver_id"),
    available_on: text(formData, "available_on"),
    start_time: nullableText(formData, "start_time"),
    end_time: nullableText(formData, "end_time"),
  });
  revalidatePath("/admin/integrations/drivers");
}
