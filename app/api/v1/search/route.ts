import { handleSearch } from "@/lib/api/v1/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSearch(request);
}
