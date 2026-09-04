import {
  handleCreateVerification,
  handleListVerification,
} from "@/lib/api/admin/verification-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleListVerification();
}

export async function POST(request: Request) {
  return handleCreateVerification(request);
}
