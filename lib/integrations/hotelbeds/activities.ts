import {
  hotelbedsProductConfigured,
  hotelbedsProductRequest,
} from "./client";

export type ActivityPax = { age: number };

export type HotelbedsActivitySearchInput = {
  destinationCode: string;
  from: string;
  to: string;
  paxes: ActivityPax[];
  language?: string;
  text?: string;
};

export type HotelbedsActivityDetailsInput = {
  code: string;
  from: string;
  to: string;
  paxes: ActivityPax[];
  language?: string;
};

export function hotelbedsActivitiesConfigured() {
  return hotelbedsProductConfigured("activities");
}

export async function searchHotelbedsActivities(
  input: HotelbedsActivitySearchInput
) {
  const searchFilterItems: Array<{ type: string; value: string }> = [
    { type: "destination", value: input.destinationCode },
  ];
  if (input.text?.trim()) {
    searchFilterItems.push({ type: "text", value: input.text.trim() });
  }

  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    "/activity-api/3.0/activities",
    {
      method: "POST",
      body: {
        filters: [{ searchFilterItems }],
        from: input.from,
        to: input.to,
        language: input.language || "en",
        paxes: input.paxes,
      },
    }
  );
}

export async function getHotelbedsActivityDetails(
  input: HotelbedsActivityDetailsInput
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    "/activity-api/3.0/activities/details",
    {
      method: "POST",
      body: {
        code: input.code,
        from: input.from,
        to: input.to,
        language: input.language || "en",
        paxes: input.paxes,
      },
    }
  );
}

export async function preconfirmHotelbedsActivity(
  bookingRequest: Record<string, unknown>
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    "/activity-api/3.0/bookings/preconfirm",
    { method: "PUT", body: bookingRequest }
  );
}

export async function reconfirmHotelbedsActivity(
  reference: string,
  language = "en"
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    "/activity-api/3.0/bookings/reconfirm",
    { method: "PUT", body: { language, reference } }
  );
}

export async function confirmHotelbedsActivity(
  bookingRequest: Record<string, unknown>
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    "/activity-api/3.0/bookings",
    { method: "PUT", body: bookingRequest }
  );
}

export async function getHotelbedsActivityBooking(
  reference: string,
  language = "en"
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    `/activity-api/3.0/bookings/${encodeURIComponent(language)}/${encodeURIComponent(reference)}`
  );
}

export async function cancelHotelbedsActivityBooking(
  reference: string,
  mode: "SIMULATION" | "CANCELLATION" = "SIMULATION",
  language = "en"
) {
  return hotelbedsProductRequest<Record<string, unknown>>(
    "activities",
    `/activity-api/3.0/bookings/${encodeURIComponent(language)}/${encodeURIComponent(reference)}?cancellationFlag=${mode}`,
    { method: "DELETE" }
  );
}
