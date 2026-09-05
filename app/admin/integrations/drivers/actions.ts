"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
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
  await updateDriverAdmin(text(formData, "driver_id"), {
    service_status: text(formData, "service_status") as "pending" | "active" | "inactive" | "suspended" | "off_duty",
  });
  revalidatePath("/admin/integrations/drivers");
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
