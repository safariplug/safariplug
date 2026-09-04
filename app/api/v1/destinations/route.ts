import { handleDestinations } from "@/lib/api/v1/handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleDestinations();
}
