import { handleListProviders } from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListProviders(request);
}
