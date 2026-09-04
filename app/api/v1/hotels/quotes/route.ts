import { handleHotelQuote } from "@/lib/api/v1/hotel-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleHotelQuote(request);
}
