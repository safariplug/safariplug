import { handleGetEvent } from "@/lib/api/v1/handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleGetEvent(request, id);
}
