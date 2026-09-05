import { handleTransferAvailability } from "@/lib/api/v1/transfer-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleTransferAvailability(request);
}
