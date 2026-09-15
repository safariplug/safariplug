import Link from "next/link";

export function OutreachLink({ prospectId }: { prospectId: string }) {
  return (
    <Link
      href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(prospectId)}`}
      className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black"
    >
      Create governed outreach →
    </Link>
  );
}
