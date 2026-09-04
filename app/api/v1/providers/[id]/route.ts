import { handleGetProvider } from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleGetProvider(id);
}
