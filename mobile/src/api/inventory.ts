import { apiGet, ApiError } from "./client";

export type InventoryStatus = "available" | "empty" | "not_configured" | "unauthorized" | "error";

export type InventoryState<T> = {
  status: InventoryStatus;
  data: T | null;
  code?: string;
  message?: string;
};

const NOT_CONFIGURED = new Set([
  "hotel_inventory_not_configured",
  "transfer_inventory_not_configured",
  "unavailable",
  "configuration_error",
]);

export async function fetchInventory<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<InventoryState<T>> {
  try {
    const result = await apiGet<T>(path, params);
    const empty =
      result.data == null ||
      (Array.isArray(result.data) && result.data.length === 0);
    return {
      status: empty ? "empty" : "available",
      data: result.data,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.code === "unauthorized") {
        return { status: "unauthorized", data: null, code: error.code, message: error.message };
      }
      if (NOT_CONFIGURED.has(error.code) || error.status === 501 || error.status === 503) {
        return {
          status: "not_configured",
          data: null,
          code: error.code,
          message: error.message,
        };
      }
      return { status: "error", data: null, code: error.code, message: error.message };
    }
    return { status: "error", data: null, message: "Unable to reach SafariPlug." };
  }
}

export function fetchHotels() {
  return fetchInventory<unknown[]>("/hotels");
}

export function fetchHotelAvailability() {
  return fetchInventory<unknown>("/hotels/availability");
}

export function fetchTransfersCatalog() {
  return fetchInventory<unknown[]>("/transfers");
}

export function fetchTransferSearch() {
  return fetchInventory<unknown[]>("/transfers/search");
}

export function fetchServices() {
  return fetchInventory<unknown[]>("/services");
}

export function fetchTrips() {
  return fetchInventory<unknown[]>("/trips");
}

export function fetchBookings() {
  return fetchInventory<unknown[]>("/bookings");
}

export function fetchProviders() {
  return fetchInventory<unknown[]>("/providers");
}
