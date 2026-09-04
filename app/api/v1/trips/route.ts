import { handleCreateTrip, handleListTrips } from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListTrips(request);
}

export async function POST(request: Request) {
  return handleCreateTrip(request);
}
