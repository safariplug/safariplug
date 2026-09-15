import Link from "next/link";
import { createContextualPartnerInvitation } from "../../invitations/create-contextual";

export type OutreachHistoryItem = {
  id: string;
  status: string;
  channel: string;
  contact_email: string | null;
  whatsapp_phone: string | null;
  created_at: string;
  sent_at: string | null;
};

export function OutreachPanel({ prospectId, invitations }: { prospectId: string; invitations: OutreachHistoryItem[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Governed outreach</h2>
          <p className="mt-1 text-sm text-zinc-500">Create a draft candidate from CRM context. Nothing is sent from Organization 360.</p>
        </div>
        <form action={createContextualPartnerInvitation}>
          <input type="hidden" name="prospect_id" value={prospectId} />
          <button className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black">Create outreach draft</button>
        </form>
      </div>
      <div className="mt-4 space-y-3">
        {invitations.map((item) => (
          <div key={item.id} className="rounded-xl border border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium capitalize">{item.status.replaceAll("_", " ")}</p>
              <span className="text-xs uppercase text-zinc-500">{item.channel}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{item.contact_email || item.whatsapp_phone || "Contact unavailable"}</p>
            <p className="mt-1 text-xs text-zinc-600">Created {new Date(item.created_at).toLocaleString()}{item.sent_at ? ` · Sent ${new Date(item.sent_at).toLocaleString()}` : ""}</p>
          </div>
        ))}
        {!invitations.length && <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-600">No governed outreach has been created for this organization.</p>}
      </div>
      <Link href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(prospectId)}`} className="mt-4 inline-block text-sm font-semibold text-amber-400">Open outreach workspace →</Link>
    </section>
  );
}
