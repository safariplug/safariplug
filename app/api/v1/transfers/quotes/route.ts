import { handleTransferQuote } from "@/lib/api/v1/transfer-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleTransferQuote(request);
}
