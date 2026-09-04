import { handleGetVerification } from "@/lib/api/admin/verification-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleGetVerification(id);
}
