import { handleRestaurantMpesaReversalCallback } from "@/lib/services/restaurant-refund-callback";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRestaurantMpesaReversalCallback(request);
}
