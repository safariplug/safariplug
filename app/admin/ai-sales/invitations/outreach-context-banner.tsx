import Link from "next/link";
import { resolveOutreachContext } from "./context";

export async function OutreachContextBanner({ prospectId }: { prospectId?: string }) {
  if (!prospectId) return null;
  const context = await resolveOutreachContext(prospectId);
  if (!context) return null;

  return (
    <section className="mt-7 rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">Organization 360 context</p>
          <h2 className="mt-2 text-lg font-semibold">{context.businessName}</h2>
          <p className="mt-1 text-sm text-zinc-400">{context.partnerType} · {context.contactEmail || context.whatsappPhone || "No contact method recorded"}</p>
          <p className="mt-2 text-xs text-zinc-500">{context.contactSource === "discovered_business_email" ? "Using a discovered public business email. No named decision-maker is being inferred." : context.contactSource === "crm_contact" ? "Using a governed CRM contact." : "No governed outreach channel is available yet."}</p>
          {context.linkageError ? <p className="mt-3 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-xs leading-5 text-red-300">CRM linkage needs staff review before a new invitation can be created. {context.linkageError}</p> : null}
          <p className="mt-1 text-xs text-zinc-600">Facts are resolved server-side. Missing information is never invented.</p>
        </div>
        <Link href={`/admin/ai-sales/edit/${encodeURIComponent(prospectId)}`} className="text-sm font-semibold text-amber-400">Back to Organization 360 →</Link>
      </div>
    </section>
  );
}
