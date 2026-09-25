import { redirect } from "next/navigation";

export default async function AccountLoginCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//")
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
  redirect(target);
}
