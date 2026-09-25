import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRole, isFullAdminRole, requireStaff } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { StaffLogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  finance_manager: "Finance Manager",
  curation_manager: "Curation Manager",
  marketing_manager: "Marketing Manager",
  support_manager: "Support Manager",
};

export default async function StaffPortalPage() {
  let user;
  try {
    user = await requireStaff();
  } catch {
    redirect("/staff/login");
  }

  const role = await getAdminRole(user.id);
  if (!role) redirect("/staff/login?error=access_denied");

  const [events, suppliers, invitations, verification] = await Promise.all([
    supabaseAdmin.from("ai_discovered_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("supplier_accounts").select("id", { count: "exact", head: true }).in("onboarding_status", ["submitted", "changes_requested", "draft", "onboarding"]),
    supabaseAdmin.from("partner_invitations").select("id", { count: "exact", head: true }).in("status", ["draft", "ready_for_approval", "approved", "signup_started", "onboarding"]),
    supabaseAdmin.from("verification_cases").select("id", { count: "exact", head: true }).in("status", ["not_started", "pending", "in_review"]),
  ]);

  const fullAdmin = isFullAdminRole(role);

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-800 pb-7">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-amber-400">SafariPlug // Staff Portal</p>
            <h1 className="mt-2 text-4xl font-bold">Operations Home</h1>
            <p className="mt-3 text-sm text-zinc-400">{user.email || "Authorized staff"} · {ROLE_LABELS[role] || role.replaceAll("_", " ")}</p>
          </div>
          <div className="flex gap-2">
            {fullAdmin && <Link href="/admin" className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black">Open Admin Command Center</Link>}
            <StaffLogoutButton />
          </div>
        </header>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Events awaiting review" value={events.count || 0} />
          <Metric label="Supplier onboarding" value={suppliers.count || 0} />
          <Metric label="Partner invitations" value={invitations.count || 0} />
          <Metric label="Verification cases" value={verification.count || 0} />
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Your access</p>
          <h2 className="mt-2 text-2xl font-semibold">{ROLE_LABELS[role] || "SafariPlug Staff"}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            This staff home is intentionally safe for launch. It shows operational workload without exposing financial or external-action controls to non-admin roles. Full administrative actions remain behind the Admin Command Center and server-side authorization.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Public SafariPlug" text="Open the customer experience exactly as travelers see it." href="/" />
          <Card title="My SafariPlug account" text="Return to your normal SafariPlug account area without signing out." href="/account" />
        </section>

        {!fullAdmin && <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="font-semibold text-amber-200">Role-scoped staff access is active</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Your account can enter the staff portal, but full admin tools are not available for this role. Additional staff workspaces can be enabled deliberately as each role is approved for launch.</p>
        </section>}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}

function Card({ title, text, href }: { title: string; text: string; href: string }) {
  return <Link href={href} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-amber-500/40"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p><p className="mt-4 text-sm font-semibold text-amber-400">Open →</p></Link>;
}
