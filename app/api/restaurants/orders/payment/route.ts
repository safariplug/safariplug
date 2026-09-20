import { POST as startRestaurantPayment } from "../pay/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return startRestaurantPayment(request);
}
