import { handleExperiences } from "@/lib/api/v1/handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleExperiences();
}
