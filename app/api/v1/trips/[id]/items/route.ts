import { handleAddTripItem } from "@/lib/api/v1/travel-handlers";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleAddTripItem(request, id);
}
