import { handleListEvents } from "@/lib/api/v1/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListEvents(request);
}
