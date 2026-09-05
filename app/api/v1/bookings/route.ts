import {
  handleCreateBooking,
  handleListBookings,
} from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListBookings(request);
}

export async function POST(request: Request) {
  return handleCreateBooking(request);
}
