import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminRole, isFinanceAdminRole, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SupplierFollowupPanel } from "./followup-panel";
import { PayoutReviewControls } from "./payout-review-controls";
import { getSupplierActivationReadiness } from "@/lib/suppliers/readiness";

export const dynamic = "force-dynamic";

type Business = {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website_url: string | null;
  instagram_url: string | null;
  status: string | null;
  city_id: string | null;
};

type Profile = {
  id: string;
  status: string | null;
  booking_status: string | null;
  service_categories: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type Offering = {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  status: string | null;
  duration_minutes: number | null;
};

type Staff = {
  id: string;
  display_name: string | null;
  personal_photo_url: string | null;
  status: string | null;
};

export default async function Partner360Page({ params }: { params: Promise<{ supplierId: string }> }) {
  const adminUser=await requireAdmin();
  const adminRole=await getAdminRole(adminUser.id);
  const canManageFinance=isFinanceAdminRole(adminRole);
  const { supplierId } = await params;

  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,prospect_id,partner_id,contact_name,invitation_status,onboarding_status,completion_percent,submitted_at,approved_at,created_at")
    .eq("id", supplierId)
    .maybeSingle();

  if (supplierError || !supplier) notFound();

  const [{ data: business, error: businessError }, { data: profiles, error: profilesError }, { data: relationship }, { data: prospect }] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id,name,description,phone,email,whatsapp,website_url,instagram_url,status,city_id")
      .eq("id", supplier.business_id)
      .maybeSingle(),
    supabaseAdmin
      .from("service_profiles")
      .select("id,status,booking_status,service_categories(name,slug)")
      .eq("business_id", supplier.business_id),
    supplier.partner_id
      ? supabaseAdmin.from("safari_partners").select("id,venue_or_promoter_name,contact_person,email_or_phone,outreach_stage,notes,created_at").eq("id", supplier.partner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supplier.prospect_id
      ? supabaseAdmin.from("ai_sales_prospects").select("id,business_name,category,city,status,opportunity_score,created_at").eq("id", supplier.prospect_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (businessError || !business) notFound();

  const profileIds = (profiles || []).map((p) => p.id);
  const [{ data: offerings }, { data: staff }, { data: verification }, { data: invites }, { data: followups, error: followupsError }, { data: preparedDraft }] = await Promise.all([
    profileIds.length
      ? supabaseAdmin.from("service_offerings").select("id,name,price,currency,status,duration_minutes,service_profile_id").in("service_profile_id", profileIds)
      : Promise.resolve({ data: [] as Offering[] }),
    profileIds.length
      ? supabaseAdmin.from("service_staff").select("id,display_name,personal_photo_url,status,service_profile_id").in("service_profile_id", profileIds)
      : Promise.resolve({ data: [] as Staff[] }),
    supabaseAdmin
      .from("verification_cases")
      .select("id,status,subject_type,created_at,updated_at")
      .eq("subject_type", "provider")
      .eq("subject_id", supplier.user_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("partner_invitations")
      .select("id,status,partner_type,contact_email,whatsapp_phone,created_at,sent_at,opened_at,signup_started_at")
      .eq("onboarded_user_id", supplier.user_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("supplier_onboarding_followups")
      .select("id,recipient_email,subject,message,missing_requirements,status,sent_at,next_followup_due_at")
      .eq("supplier_id", supplier.id)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("supplier_onboarding_followup_drafts")
      .select("id,recipient_email,subject,message,missing_requirements,comparison,prepared_at,status")
      .eq("supplier_id", supplier.id)
      .eq("status", "prepared")
      .maybeSingle(),
  ]);

  const b = business as Business;
  const ps = (profiles || []) as Profile[];
  const os = (offerings || []) as Offering[];
  const ss = (staff || []) as Staff[];
  const personalPhotos = ss.filter((s) => Boolean(s.personal_photo_url)).length;
  const staffIds = ss.map((s) => s.id);
  const [{ count: activeAvailabilityCount }, { data: payoutAccount }] = await Promise.all([
    staffIds.length
      ? supabaseAdmin.from("service_staff_availability").select("id", { count: "exact", head: true }).in("staff_id", staffIds).eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    supabaseAdmin.from("service_provider_payout_accounts").select("status,phone,verified_at,updated_at").eq("provider_user_id", supplier.user_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const readiness = await getSupplierActivationReadiness(supplier.id);
  const latestVerification = verification?.[0];
  const followupRows = followups || [];
  const latestFollowup = followupRows[0];
  const dueMs = latestFollowup?.next_followup_due_at ? Date.parse(latestFollowup.next_followup_due_at) : NaN;
  const followupState = !latestFollowup
    ? "not_sent"
    : Number.isFinite(dueMs) && dueMs <= Date.now()
      ? "overdue"
      : "waiting";
  const nextAction = nextActionFor(
    supplier.onboarding_status,
    readiness,
    followupState,
    latestFollowup?.next_followup_due_at,
  );
  const warnings = [profilesError ? "Service profile details could not be fully loaded." : null, followupsError ? "Follow-up history could not be loaded." : null].filter(Boolean);
  const loadWarning = warnings.length ? warnings.join(" ") : null;

  return (
    <main className="min-h-screen bg-[#070707] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/ai-sales/partners" className="text-sm text-zinc-400 hover:text-white">← Partner CRM</Link>
        <header className="mt-5 flex flex-col justify-between gap-5 border-b border-zinc-800 pb-7 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[.2em] text-amber-400">Partner 360</p>
            <h1 className="mt-2 text-3xl font-bold">{b.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">{supplier.contact_name || "No contact name"} · {b.email || b.phone || "No contact channel"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Status label="Onboarding" value={supplier.onboarding_status} />
            <Status label="Business" value={b.status || "unknown"} />
            <Status label="Verification" value={latestVerification?.status || "not started"} />
          </div>
        </header>

        {loadWarning && <div className="mt-5 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">{loadWarning}</div>}

        <section className="mt-7 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Next action</p>
          <h2 className="mt-2 text-xl font-semibold">{nextAction.title}</h2>
          <p className="mt-1 text-sm text-zinc-300">{nextAction.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {nextAction.href && <Link href={nextAction.href} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black">{nextAction.cta}</Link>}
            <Link href="/admin/ai-sales/invitations" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm">Invitation center</Link>
            {supplier.prospect_id && <Link href={`/admin/ai-sales/edit/${supplier.prospect_id}`} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm">Open prospect 360</Link>}
          </div>
        </section>

        <section className={`mt-7 rounded-2xl border p-5 ${readiness.ready ? "border-emerald-800 bg-emerald-950/20" : "border-amber-800 bg-amber-950/20"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Activation readiness</p>
              <h2 className="mt-2 text-xl font-semibold">{readiness.ready ? "Ready for human approval" : `${readiness.issues.length} requirement${readiness.issues.length === 1 ? "" : "s"} remaining`}</h2>
              <p className="mt-1 text-sm text-zinc-400">This is the same canonical gate used by approval, supplier portal, and reminder drafts.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${readiness.ready ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}>
              {readiness.ready ? "Ready" : `${readiness.completionPercent}% profile`}
            </span>
          </div>
          {readiness.issues.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">
            {readiness.issues.map((item) => <Link key={item.key} href={item.href} className="rounded-xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-200 hover:border-amber-700">
              <span>{item.label}</span><span className="ml-2 text-amber-300">→</span>
            </Link>)}
          </div> : <p className="mt-4 text-sm text-emerald-300">All activation requirements are satisfied. Staff approval is still required before activation.</p>}
        </section>

        <SupplierFollowupPanel
          supplierId={supplier.id}
          eligible={["draft","onboarding","changes_requested"].includes(String(supplier.onboarding_status || ""))}
          initialPreparedDraft={preparedDraft ? {
            id: preparedDraft.id,
            recipient: preparedDraft.recipient_email,
            subject: preparedDraft.subject,
            message: preparedDraft.message,
            missingRequirements: Array.isArray(preparedDraft.missing_requirements) ? preparedDraft.missing_requirements.map(String) : [],
            followupComparison: preparedDraft.comparison && typeof preparedDraft.comparison === "object" ? preparedDraft.comparison as {
              previousSentAt: string;
              resolvedSinceLast: string[];
              stillMissing: string[];
              newlyMissing: string[];
            } : null,
            source: "scheduled_prepared",
            preparedAt: preparedDraft.prepared_at,
          } : null}
          initialHistory={followupRows.map((row) => ({
            id: row.id,
            recipientEmail: row.recipient_email,
            subject: row.subject,
            message: row.message,
            missingRequirements: Array.isArray(row.missing_requirements) ? row.missing_requirements.map(String) : [],
            sentAt: row.sent_at,
            nextFollowupDueAt: row.next_followup_due_at,
            status: row.status,
          }))}
        />

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <Metric label="Onboarding" value={`${supplier.completion_percent || 0}%`} />
          <Metric label="Offerings" value={String(os.length)} />
          <Metric label="Team" value={String(ss.length)} />
          <Metric label="Personal photos" value={`${personalPhotos}/${ss.length}`} />
          <Metric label="Availability" value={String(activeAvailabilityCount || 0)} />
          <Metric label="Payout" value={payoutAccount?.status || "not set up"} />
          <Metric label="Invitations" value={String(invites?.length || 0)} />
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <Card title="Business & contact">
            <Field label="Business" value={b.name} />
            <Field label="Contact" value={supplier.contact_name} />
            <Field label="Email" value={b.email} />
            <Field label="Phone" value={b.phone} />
            <Field label="WhatsApp" value={b.whatsapp} />
            <Field label="Website" value={b.website_url} />
            <Field label="Instagram" value={b.instagram_url} />
          </Card>
          <Card title="Enrollment & governance">
            <Field label="Invitation" value={supplier.invitation_status} />
            <Field label="Onboarding" value={supplier.onboarding_status} />
            <Field label="Completion" value={`${supplier.completion_percent || 0}%`} />
            <Field label="Submitted" value={date(supplier.submitted_at)} />
            <Field label="Approved" value={date(supplier.approved_at)} />
            <Field label="Verification" value={latestVerification?.status || "Not started"} />
            <Field label="Active availability" value={String(activeAvailabilityCount || 0)} />
            <Field label="Payout status" value={payoutAccount?.status || "Not set up"} />
            <Field label="Payout phone" value={payoutAccount?.phone || null} />
            {payoutAccount ? <PayoutReviewControls providerUserId={supplier.user_id} status={payoutAccount.status || null} canManageFinance={canManageFinance} /> : <p className="mt-4 text-xs text-amber-300">Supplier has not configured an M-Pesa payout destination yet.</p>}
            <p className="mt-4 text-xs leading-5 text-zinc-500">Verification and activation remain governed. Partner 360 does not automatically verify, approve, publish, or open bookings.</p>
          </Card>
        </div>

        <section className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold">CRM relationship context</h2><p className="mt-1 text-xs text-zinc-500">Stable identifiers only. SafariPlug does not guess links from matching business names.</p></div>
            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase ${supplier.prospect_id || supplier.partner_id ? "border-emerald-700 text-emerald-400" : "border-zinc-700 text-zinc-500"}`}>{supplier.prospect_id || supplier.partner_id ? "linked" : "unlinked"}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-900 p-4">
              <p className="text-xs uppercase text-zinc-500">Discovery prospect</p>
              {prospect ? <><p className="mt-2 font-semibold">{prospect.business_name}</p><p className="mt-1 text-sm text-zinc-400">{prospect.category || "Uncategorized"} · {prospect.city || "City not recorded"}</p><p className="mt-2 text-xs text-zinc-500">Status {prospect.status || "unknown"} · Opportunity {prospect.opportunity_score ?? "—"}</p><Link href={`/admin/ai-sales/edit/${prospect.id}`} className="mt-3 inline-block text-sm font-semibold text-amber-400">Open prospect 360 →</Link></> : <p className="mt-2 text-sm text-zinc-500">No stable prospect link recorded.</p>}
            </div>
            <div className="rounded-xl border border-zinc-900 p-4">
              <p className="text-xs uppercase text-zinc-500">Partner relationship</p>
              {relationship ? <><p className="mt-2 font-semibold">{relationship.venue_or_promoter_name}</p><p className="mt-1 text-sm text-zinc-400">{relationship.contact_person || relationship.email_or_phone || "No relationship contact recorded"}</p><p className="mt-2 text-xs text-zinc-500">Stage {(relationship.outreach_stage || "unknown").replaceAll("_", " ")}</p></> : <p className="mt-2 text-sm text-zinc-500">No stable partner relationship link recorded.</p>}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5"><h2 className="font-semibold">Inventory & team readiness</h2></div>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-zinc-500">Profiles</p>
              {ps.length ? ps.map((p) => <div key={p.id} className="mt-3 rounded-xl border border-zinc-800 p-3"><p className="font-medium">{categoryName(p.service_categories) || "Service profile"}</p><p className="mt-1 text-xs text-zinc-500">{p.status || "unknown"} · bookings {p.booking_status || "unknown"}</p></div>) : <p className="mt-3 text-sm text-zinc-500">No service profiles recorded.</p>}
              <p className="mt-5 text-xs uppercase text-zinc-500">Offerings</p>
              {os.length ? os.map((o) => <div key={o.id} className="mt-3 rounded-xl border border-zinc-800 p-3"><p className="font-medium">{o.name}</p><p className="mt-1 text-xs text-zinc-500">{o.price != null ? `${o.currency || ""} ${o.price}` : "No recorded price"} · {o.status || "unknown"}</p></div>) : <p className="mt-3 text-sm text-zinc-500">No service offerings recorded.</p>}
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-500">Team identity</p>
              {ss.length ? ss.map((s) => <div key={s.id} className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 p-3"><div><p className="font-medium">{s.display_name || "Unnamed team member"}</p><p className="text-xs text-zinc-500">{s.status || "unknown"}</p></div><span className={`text-xs ${s.personal_photo_url ? "text-emerald-400" : "text-amber-300"}`}>{s.personal_photo_url ? "Photo recorded" : "Photo missing"}</span></div>) : <p className="mt-3 text-sm text-zinc-500">No staff records.</p>}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5"><h2 className="font-semibold">Recruitment timeline</h2><p className="mt-1 text-xs text-zinc-500">Invitation-link activity, not email pixel tracking.</p></div>
          <div className="divide-y divide-zinc-900">{invites?.length ? invites.map((i) => <div key={i.id} className="p-4"><div className="flex justify-between gap-4"><p className="font-medium">{i.partner_type}</p><span className="font-mono text-xs uppercase text-amber-300">{i.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-zinc-500">Sent {date(i.sent_at)} · Link opened {date(i.opened_at)} · Signup started {date(i.signup_started_at)}</p></div>) : <p className="p-5 text-sm text-zinc-500">No linked recruitment invitation found for this supplier account.</p>}</div>
        </section>
      </div>
    </main>
  );
}

function categoryName(value: Profile["service_categories"]) {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name || null : value.name;
}

function nextActionFor(
  status: string,
  readiness: { ready: boolean; completionPercent: number; issues: { label: string }[] },
  followupState: "not_sent" | "waiting" | "overdue" = "not_sent",
  nextFollowupDueAt?: string | null,
) {
  if (status === "submitted") {
    if (!readiness.ready) return { title: "Resolve activation blockers before approval", detail: `${readiness.issues.length} canonical activation requirement${readiness.issues.length === 1 ? "" : "s"} remain. Approval is blocked until they are complete.`, href: "/admin/suppliers", cta: "Open supplier review" };
    return { title: "Review supplier submission", detail: "This supplier passed the activation-readiness gate and is waiting for a human decision.", href: "/admin/suppliers", cta: "Open supplier review" };
  }
  if (status === "changes_requested") return { title: "Waiting for partner changes", detail: "Changes were requested. Do not activate until the partner resubmits and requirements are reviewed.", href: "/admin/suppliers", cta: "Review status" };
  if (status === "approved" || status === "live") return { title: "Partner is operationally approved", detail: "Continue relationship management, payout governance and inventory quality checks.", href: "/admin/suppliers", cta: "Open governance" };
  if (!readiness.ready) {
    if (followupState === "overdue") return { title: "Supplier follow-up is overdue", detail: `Profile is ${readiness.completionPercent}% complete and ${readiness.issues.length} activation requirement${readiness.issues.length === 1 ? "" : "s"} remain. Review the previous email and prepare the next reminder.`, href: "#onboarding-followup", cta: "Review overdue follow-up" };
    if (followupState === "waiting") return { title: "Waiting on supplier", detail: `Profile is ${readiness.completionPercent}% complete. The next follow-up review is scheduled for ${nextFollowupDueAt ? new Date(nextFollowupDueAt).toLocaleString() : "later"}.`, href: "#onboarding-followup", cta: "View follow-up history" };
    return { title: "Onboarding is incomplete", detail: `${readiness.issues.length} activation requirement${readiness.issues.length === 1 ? "" : "s"} remain. Draft follow-up from the canonical readiness list.`, href: "#onboarding-followup", cta: "Draft follow-up email" };
  }
  return { title: "Prepare for supplier review", detail: "Activation requirements are complete, but the supplier has not yet reached an approved/live state.", href: "/admin/suppliers", cta: "Open supplier review" };
}

function Status({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"><p className="text-[10px] uppercase text-zinc-500">{label}</p><p className="mt-1 text-xs font-semibold capitalize text-amber-300">{value.replaceAll("_", " ")}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="mb-4 font-semibold">{title}</h2>{children}</section>; }
function Field({ label, value }: { label: string; value: string | null | undefined }) { return <div className="flex justify-between gap-4 border-t border-zinc-900 py-2 text-sm"><span className="text-zinc-500">{label}</span><span className="max-w-[65%] text-right">{value || "—"}</span></div>; }
function date(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "—"; }
