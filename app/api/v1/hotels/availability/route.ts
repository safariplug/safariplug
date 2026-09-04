import { handleHotelAvailability } from "@/lib/api/v1/hotel-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleHotelAvailability(request);
}
