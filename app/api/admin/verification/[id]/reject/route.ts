import { handleRejectVerification } from "@/lib/api/admin/verification-handlers";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleRejectVerification(request, id);
}
