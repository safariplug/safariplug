"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Business = {
  name?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  supplier_gallery_urls?: string[] | null;
  business_type?: string | null;
};
type Account = { onboarding_status?: string | null; completion_percent?: number | null; review_items?: string[] | null; review_note?: string | null };
type SupplierData = { business?: Business | null; account?: Account | null; profile?: unknown | null; offerings?: unknown[] | null; staff?: Array<{ personal_photo_url?: string | null }> | null; availability?: unknown[] | null };
type Blocker = { key: string; title: string; detail: string; href: string; done: boolean };

export default function SupplierReadinessPage() {
  const [data, setData] = useState<SupplierData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void (async () => {
    const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
    const body = await response.json().catch(() => null) as SupplierData & { error?: string } | null;
    if (!response.ok) return setError(body?.error || "Unable to load readiness.");
    setData(body || {});
  })(); }, []);

  const blockers = useMemo<Blocker[]>(() => {
    if (!data) return [];
    const business = data.business || {};
    const type = String(business.business_type || "");
    const appointment = Boolean(data.profile) && !["Restaurant", "Hotel", "Event Organizer"].includes(type);
    const contact = Boolean(business.phone || business.email || business.whatsapp);
    const basics = Boolean(business.name && business.description && business.address && contact);
    const images = Boolean(business.logo_url || business.cover_image_url || (Array.isArray(business.supplier_gallery_urls) && business.supplier_gallery_urls.length));
    const offerings = !appointment || Boolean(data.offerings?.length);
    const team = !appointment || Boolean(data.staff?.length);
    const photos = !appointment || Boolean(data.staff?.length && data.staff.every((member) => Boolean(member.personal_photo_url)));
    const availability = !appointment || Boolean(data.availability?.length);
    return [
      { key: "business_details", title: "Business details", detail: "Name, description, address and a working contact channel.", href: "/supplier/onboarding", done: basics },
      { key: "business_images", title: "Business images", detail: "Add a logo, cover image or gallery image.", href: "/supplier/onboarding", done: images },
      { key: "services_pricing", title: "Services & pricing", detail: appointment ? "Add at least one service with pricing." : "Category-specific setup is handled in your supplier workspace.", href: "/supplier/onboarding", done: offerings },
      { key: "team", title: "Team", detail: appointment ? "Add at least one person who delivers the service." : "Not required for this supplier type.", href: "/supplier/onboarding", done: team },
      { key: "personal_photos", title: "Personal photos", detail: appointment ? "Every service provider should have a personal photo." : "Not required for this supplier type.", href: "/supplier/onboarding", done: photos },
      { key: "availability", title: "Availability", detail: appointment ? "Add at least one working-time slot." : "Not required for this supplier type.", href: "/supplier/onboarding", done: availability },
    ];
  }, [data]);

  if (error) return <main className="mx-auto max-w-4xl px-6 py-10"><p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-4xl px-6 py-10"><p className="text-sm text-black/50">Loading readiness…</p></main>;

  const incomplete = blockers.filter((item) => !item.done);
  const score = Number(data.account?.completion_percent || 0);
  const status = String(data.account?.onboarding_status || "draft");
  const requested = Array.isArray(data.account?.review_items) ? data.account?.review_items : [];

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Supplier</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">Readiness center</h1></div><Link href="/supplier" className="rounded-full border border-black/15 px-4 py-2 text-sm">Back to onboarding</Link></div>
    <p className="mt-3 max-w-2xl text-black/55">This check uses your existing SafariPlug data and costs no AI credits. It shows what is blocking submission or review readiness.</p>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <Metric label="Profile score" value={`${score}%`} />
      <Metric label="Open blockers" value={String(incomplete.length)} />
      <Metric label="Status" value={status.replaceAll("_", " ")} />
    </section>

    {requested.length > 0 && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-900/60">Staff-requested changes</p><p className="mt-2 text-sm text-black/60">SafariPlug requested {requested.length} fix{requested.length === 1 ? "" : "es"}. These take priority over the general checklist.</p><Link href="/supplier/ai-help" className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Get help fixing them →</Link></section>}

    <section className="mt-6 rounded-3xl border border-black/10 p-5 md:p-6">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-black/40">Readiness blockers</p><h2 className="mt-1 text-2xl font-semibold">{incomplete.length ? `${incomplete.length} item${incomplete.length === 1 ? "" : "s"} to finish` : "Core onboarding looks complete"}</h2></div></div>
      <div className="mt-4 divide-y divide-black/10">{blockers.map((item) => <div key={item.key} className="flex items-start gap-3 py-4"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.done ? "bg-emerald-600 text-white" : "bg-black/[.06] text-black/50"}`}>{item.done ? "✓" : "!"}</span><div className="min-w-0 flex-1"><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-black/50">{item.detail}</p></div>{!item.done && <Link href={item.href} className="shrink-0 text-sm font-semibold">Fix →</Link>}</div>)}</div>
    </section>

    <section className="mt-6 rounded-2xl bg-black/[.03] p-5"><h2 className="font-semibold">What happens next</h2><p className="mt-1 text-sm leading-6 text-black/55">Once your core profile reaches the submission threshold, you can submit it for human review. Verification, approval and publishing remain staff-controlled.</p></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-1 text-xl font-semibold capitalize">{value}</p></div>; }
