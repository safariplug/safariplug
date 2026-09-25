import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OutreachPanel } from "./outreach-panel";
import { loadProspectOutreachHistory } from "../../invitations/history";
import { resolveStablePartnerIdForProspect } from "@/lib/services/crm-partner-link";
import { salesProspectQualityIssues } from "@/lib/services/sales-prospect-quality";
import {
  approveSalesProspect,
  rejectSalesProspect,
  addCRMContact,
  updateCRMContact,
  setPrimaryCRMContact,
  addCRMActivity,
  addCRMFollowup,
  completeCRMFollowup,
  recordCRMConversion,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const { data: p, error } = await supabaseAdmin.from("ai_sales_prospects").select("*").eq("id", id).single();
  if (error || !p) {
    return <main className="min-h-screen bg-[#070707] p-8 text-white"><Link href="/admin/crm" className="text-amber-400">← CRM</Link><p className="mt-8">Prospect not found.</p></main>;
  }

  const [{ data: supplier }, { data: contacts, error: ce }, { data: activities, error: ae }, { data: followups, error: fe }, { data: conversions, error: xe }, outreach] = await Promise.all([
    supabaseAdmin.from("supplier_accounts").select("id,partner_id,onboarding_status,completion_percent").eq("prospect_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("crm_contacts").select("id,full_name,job_title,email,phone,linkedin_url,source_url,notes,is_primary,verification_status,created_at,partner_id").eq("prospect_id", id).order("is_primary", { ascending: false }).order("created_at"),
    supabaseAdmin.from("crm_activities").select("id,activity_type,summary,details,occurred_at").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(30),
    supabaseAdmin.from("crm_followups").select("id,title,due_at,status,priority,notes").eq("prospect_id", id).order("due_at"),
    supabaseAdmin.from("crm_conversions").select("id,outcome,source,notes,occurred_at").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(20),
    loadProspectOutreachHistory(id),
  ]);

  const stablePartnerId = await resolveStablePartnerIdForProspect(id);
  const { data: partner } = stablePartnerId
    ? await supabaseAdmin.from("safari_partners").select("id,outreach_stage").eq("id", stablePartnerId).maybeSingle()
    : { data: null };

  const open = (followups || []).filter((x) => x.status === "open");
  const overdue = open.filter((x) => new Date(x.due_at) < new Date());
  const latest = conversions?.[0];
  const dbError = ce || ae || fe || xe || outreach.error;
  const hasDiscoveredContact = Boolean(p.contact_email || p.phone || p.website || p.instagram || p.facebook);
  const canDraftOutreach = Boolean(p.contact_email || (contacts || []).some((contact) => contact.email || contact.phone));
  const qualityIssues = salesProspectQualityIssues(p);

  return (
    <main className="min-h-screen bg-[#070707] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between">
          <Link href="/admin/crm" className="text-sm text-amber-400">← CRM 2.0</Link>
          <Link href={`/admin/ai-sales/invitations?prospect_id=${encodeURIComponent(id)}`} className="text-sm text-zinc-400">Outreach Review →</Link>
        </div>

        <header className="mt-6 border-b border-zinc-800 pb-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-amber-400">Organization 360 · Contact Governance</p>
          <h1 className="mt-2 text-4xl font-bold">{p.business_name}</h1>
          <p className="mt-2 text-sm text-zinc-400">{p.category || "Uncategorized"} · {p.city || "City not recorded"}</p>
        </header>

        {dbError && <div className="mt-5 rounded-xl border border-red-900 bg-red-950/20 p-4 text-sm text-red-300">CRM data could not be fully loaded. Failed queries are not represented as zero.</div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric l="Opportunity" v={`${Number(p.opportunity_score || 0)}%`} />
          <Metric l="Relationship" v={partner?.outreach_stage?.replaceAll("_", " ") || (supplier ? "Supplier onboarding" : "Not enrolled")} />
          <Metric l="Latest outcome" v={latest?.outcome?.replaceAll("_", " ") || "None"} />
          <Metric l="Named contacts" v={String(contacts?.length || 0)} />
          <Metric l="Open follow-ups" v={String(open.length)} />
          <Metric l="Overdue" v={String(overdue.length)} />
        </section>

        {supplier ? <section className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-400/70">Supplier handoff</p>
              <h2 className="mt-1 text-lg font-semibold">This prospect is linked to supplier onboarding.</h2>
              <p className="mt-1 text-sm text-zinc-400">{supplier.completion_percent || 0}% complete · {supplier.onboarding_status.replaceAll("_", " ")}</p>
            </div>
            <Link href={`/admin/ai-sales/partners/${supplier.id}`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold">Open Partner 360 →</Link>
          </div>
        </section> : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <OutreachPanel prospectId={id} invitations={outreach.invitations} canDraft={canDraftOutreach} approved={p.review_status === "approved"} />

            <Panel t="Follow-up intelligence">
              {overdue.length > 0 && <div className="mb-4 rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-300">{overdue.length} follow-up{overdue.length === 1 ? " is" : "s are"} overdue and needs attention.</div>}
              <div className="space-y-3">
                {open.map((f) => <div key={f.id} className="rounded-xl border border-zinc-800 p-4"><div className="flex justify-between"><p className="font-medium">{f.title}</p><span className="text-xs uppercase text-amber-400">{f.priority}</span></div><p className="mt-1 text-xs text-zinc-500">Due {new Date(f.due_at).toLocaleString()}</p>{f.notes && <p className="mt-2 text-sm text-zinc-400">{f.notes}</p>}<form action={completeCRMFollowup.bind(null, id)}><input type="hidden" name="followup_id" value={f.id} /><button className="mt-3 text-xs font-semibold text-emerald-400">Mark complete ✓</button></form></div>)}
                {!open.length && <Empty text="No open follow-ups." />}
              </div>
              <form action={addCRMFollowup.bind(null, id)} className="mt-4 grid gap-2">
                <Input n="title" p="Follow-up title *" />
                <input name="due_at" type="datetime-local" required className="rounded-xl border border-zinc-800 bg-black p-3 text-sm" />
                <select name="priority" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select>
                <textarea name="notes" placeholder="Notes" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm" />
                <button className="rounded-xl bg-amber-400 p-3 text-sm font-bold text-black">Schedule follow-up</button>
              </form>
            </Panel>

            <Panel t="Conversion outcomes">
              <div className="space-y-3">
                {(conversions || []).map((x) => <div key={x.id} className="border-l border-zinc-800 pl-4"><p className="text-sm font-medium capitalize">{x.outcome.replaceAll("_", " ")} <span className="text-xs text-zinc-600">· {x.source}</span></p><p className="text-xs text-zinc-600">{new Date(x.occurred_at).toLocaleString()}</p>{x.notes && <p className="mt-1 text-sm text-zinc-500">{x.notes}</p>}</div>)}
                {!conversions?.length && <Empty text="No conversion outcomes recorded." />}
              </div>
              <form action={recordCRMConversion.bind(null, id)} className="mt-4 grid gap-2">
                <select name="outcome" required className="rounded-xl border border-zinc-800 bg-black p-3 text-sm"><option value="qualified">Qualified</option><option value="meeting_booked">Meeting booked</option><option value="proposal_sent">Proposal sent</option><option value="partnered">Partnered</option><option value="lost">Lost</option><option value="disqualified">Disqualified</option></select>
                <textarea name="notes" placeholder="Outcome evidence / notes" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm" />
                <button className="rounded-xl border border-zinc-700 p-3 text-sm font-semibold">Record human-confirmed outcome</button>
              </form>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel t="Discovered business contact">
              {hasDiscoveredContact ? <div className="space-y-2">
                <ContactField label="Email" value={p.contact_email} />
                <ContactField label="Phone" value={p.phone} />
                <ContactField label="Website" value={p.website} link />
                <ContactField label="Instagram" value={p.instagram} link />
                <ContactField label="Facebook" value={p.facebook} link />
                <ContactField label="Research source" value={p.source_url} link />
                <p className="pt-2 text-xs leading-5 text-zinc-500">These are public business contact details discovered during Supplier Scout research. They are separate from named decision-maker contacts and remain unverified until reviewed by a person.</p>
              </div> : <Empty text="No public business email, phone, website, or social contact path is recorded." />}
            </Panel>

            <Panel t="Decision-maker contacts">
              <div className="space-y-4">
                {(contacts || []).map((c) => <form key={c.id} action={updateCRMContact.bind(null, id)} className="rounded-xl border border-zinc-800 p-4"><input type="hidden" name="contact_id" value={c.id} /><div className="mb-3 flex items-center justify-between"><div><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">Contact record</span>{c.is_primary && <span className="ml-2 text-xs font-bold text-amber-400">PRIMARY</span>}</div><span className={`text-xs font-semibold uppercase ${c.verification_status === "verified" ? "text-emerald-400" : c.verification_status === "invalid" ? "text-red-400" : "text-zinc-500"}`}>{c.verification_status}</span></div><div className="grid gap-2 sm:grid-cols-2"><Input n="full_name" p="Full name *" v={c.full_name} /><Input n="job_title" p="Job title" v={c.job_title || ""} /><Input n="email" p="Email" v={c.email || ""} /><Input n="phone" p="Phone" v={c.phone || ""} /><Input n="linkedin_url" p="LinkedIn URL" v={c.linkedin_url || ""} /><Input n="source_url" p="Source URL" v={c.source_url || ""} /><select name="verification_status" defaultValue={c.verification_status} className="rounded-xl border border-zinc-800 bg-black p-3 text-sm"><option value="unverified">Unverified</option><option value="verified">Verified</option><option value="invalid">Invalid</option></select><label className="flex items-center rounded-xl border border-zinc-800 px-3 text-xs text-zinc-400"><input type="checkbox" name="is_primary" defaultChecked={c.is_primary} className="mr-2" />Primary contact</label></div><textarea name="notes" defaultValue={c.notes || ""} placeholder="Contact notes" className="mt-2 w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm" /><div className="mt-3 flex gap-3"><button className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-bold text-black">Save contact</button>{!c.is_primary && <button formAction={setPrimaryCRMContact.bind(null, id)} className="rounded-lg border border-amber-900 px-3 py-2 text-xs font-semibold text-amber-400">Make primary</button>}</div></form>)}
                {!contacts?.length && <Empty text="No named decision-maker contacts." />}
              </div>
              <form action={addCRMContact.bind(null, id)} className="mt-5 grid gap-2 sm:grid-cols-2">
                <Input n="full_name" p="Full name *" /><Input n="job_title" p="Job title" /><Input n="email" p="Email" /><Input n="phone" p="Phone" /><Input n="linkedin_url" p="LinkedIn URL" /><Input n="source_url" p="Source URL" />
                <textarea name="notes" placeholder="Contact notes" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm sm:col-span-2" />
                <label className="text-xs text-zinc-400"><input type="checkbox" name="is_primary" className="mr-2" />Primary</label>
                <button className="rounded-xl bg-amber-400 p-2 text-sm font-bold text-black">Add contact</button>
              </form>
            </Panel>

            <Panel t="Relationship timeline">
              {(activities || []).map((a) => <div key={a.id} className="border-l border-zinc-800 py-2 pl-4"><p className="text-sm font-medium">{a.summary}</p><p className="text-xs text-zinc-600">{a.activity_type.replaceAll("_", " ")} · {new Date(a.occurred_at).toLocaleString()}</p>{a.details && <p className="mt-1 text-sm text-zinc-500">{a.details}</p>}</div>)}
              {!activities?.length && <Empty text="No activities." />}
              <form action={addCRMActivity.bind(null, id)} className="mt-4 grid gap-2">
                <select name="activity_type" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm"><option value="note">Note</option><option value="research">Research</option><option value="call">Call</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option></select>
                <Input n="summary" p="Summary *" />
                <textarea name="details" placeholder="Details" className="rounded-xl border border-zinc-800 bg-black p-3 text-sm" />
                <button className="rounded-xl border border-zinc-700 p-3 text-sm">Record activity</button>
              </form>
            </Panel>

            <Panel t="Governance"><p className="text-sm leading-6 text-zinc-400">Only one primary named contact is allowed per prospect. Verification is an explicit human-controlled CRM state. Supplier Scout can record public business contact channels, but AI cannot mark a named contact verified or send outreach without human action.</p></Panel>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="font-semibold">Human decision</h2>
          {qualityIssues.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
              <p className="text-sm font-semibold text-amber-300">Approval is blocked until the prospect quality issues below are fixed.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/75">
                {qualityIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-400">Quality gate passed: direct business contact and external source evidence are recorded.</p>
          )}
          <div className="mt-4 flex gap-3"><form action={approveSalesProspect.bind(null, id)}><button disabled={qualityIssues.length > 0} className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">Approve for outreach</button></form><form action={rejectSalesProspect.bind(null, id)}><button className="rounded-xl border border-red-900 px-5 py-3 text-sm text-red-300">Reject</button></form></div>
        </section>
      </div>
    </main>
  );
}

function ContactField({ label, value, link = false }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) return null;
  return <div className="flex items-start justify-between gap-4 border-t border-zinc-900 py-2 text-sm"><span className="text-zinc-500">{label}</span>{link ? <a href={value} target="_blank" rel="noreferrer" className="max-w-[70%] break-all text-right text-amber-400 hover:underline">{value}</a> : <span className="max-w-[70%] break-all text-right">{value}</span>}</div>;
}
function Panel({ t, children }: { t: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold">{t}</h2><div className="mt-4">{children}</div></section>; }
function Metric({ l, v }: { l: string; v: string }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">{l}</p><p className="mt-2 truncate text-xl font-bold capitalize">{v}</p></div>; }
function Input({ n, p, v }: { n: string; p: string; v?: string }) { return <input name={n} placeholder={p} defaultValue={v} className="rounded-xl border border-zinc-800 bg-black p-3 text-sm" />; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-600">{text}</p>; }
