import { handleAvailability } from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleAvailability();
}
