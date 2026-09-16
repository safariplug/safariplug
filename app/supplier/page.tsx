"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Supplier = {
  business?: Record<string, any>;
  account?: Record<string, any>;
  profile?: Record<string, any> | null;
  offerings?: Record<string, any>[];
  staff?: Record<string, any>[];
  availability?: Record<string, any>[];
};

type Step = { title: string; body: string; href: string; cta: string; complete: boolean };

export default function SupplierHomePage() {
  const [supplier, setSupplier] = useState<Supplier>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "Please sign in through your supplier invitation first.");
      setSupplier(data);
    })();
  }, []);

  const type = String(supplier.business?.business_type || "");
  const isRestaurant = type === "Restaurant";
  const isHotel = type === "Hotel";
  const isEvents = type === "Event Organizer";
  const isAppointment = Boolean(supplier.profile) && !isRestaurant && !isHotel && !isEvents;
  const status = String(supplier.account?.onboarding_status || "draft");
  const submitted = ["submitted", "approved", "live"].includes(status);
  const approved = ["approved", "live"].includes(status);

  const steps = useMemo<Step[]>(() => {
    const business = supplier.business || {};
    const hasContact = Boolean(business.phone || business.email || business.whatsapp);
    const businessBasics = Boolean(business.name && business.description && business.address && hasContact);
    const hasImages = Boolean(business.logo_url || business.cover_image_url || (Array.isArray(business.supplier_gallery_urls) && business.supplier_gallery_urls.length));
    const offeringsReady = !isAppointment || Boolean(supplier.offerings?.length);
    const teamReady = !isAppointment || Boolean(supplier.staff?.length);
    const availabilityReady = !isAppointment || Boolean(supplier.availability?.length);

    const categoryStep = isRestaurant
      ? { title: "Restaurant setup", body: "Finish menu and ordering setup.", href: "/supplier/restaurant", cta: "Continue restaurant setup", complete: true }
      : isHotel
        ? { title: "Hotel setup", body: "Finish property and booking setup.", href: "/supplier/hotel", cta: "Continue hotel setup", complete: true }
        : isEvents
          ? { title: "Event setup", body: "Prepare your organizer profile and listings.", href: "/supplier/events", cta: "Continue event setup", complete: true }
          : { title: "Services & pricing", body: "Add at least one service, price and duration.", href: "/supplier/onboarding", cta: "Add services", complete: offeringsReady };

    const list: Step[] = [
      { title: "Business details", body: "Business name, description, address and contact information.", href: "/supplier/onboarding", cta: "Complete business details", complete: businessBasics },
      { title: "Business images", body: "Add a logo, cover image or gallery photo.", href: "/supplier/onboarding", cta: "Add business images", complete: hasImages },
      categoryStep,
    ];

    if (isAppointment) {
      list.push(
        { title: "Team", body: "Add the people who deliver your services.", href: "/supplier/onboarding", cta: "Add your team", complete: teamReady },
        { title: "Availability", body: "Add at least one working-time slot.", href: "/supplier/onboarding", cta: "Set availability", complete: availabilityReady },
      );
    }

    list.push({
      title: submitted ? (approved ? "Approved" : "Under review") : "Submit for review",
      body: submitted ? (approved ? "Your supplier profile is approved." : "SafariPlug is reviewing your submission.") : "Send your profile to SafariPlug when you are ready.",
      href: "/supplier/onboarding",
      cta: submitted ? "View submission" : "Review and submit",
      complete: submitted,
    });
    return list;
  }, [supplier, isAppointment, isRestaurant, isHotel, isEvents, submitted, approved]);

  const nextStep = steps.find((step) => !step.complete) || steps[steps.length - 1];
  const completeCount = steps.filter((step) => step.complete).length;
  const journeyPercent = steps.length ? Math.round((completeCount / steps.length) * 100) : 0;
  const profilePercent = Number(supplier.account?.completion_percent || 0);

  if (!supplier.business && !message) return <main className="mx-auto max-w-4xl px-6 py-16"><h1 className="text-3xl font-semibold">Supplier Portal</h1><p className="mt-3 text-black/60">Loading your onboarding…</p></main>;

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Supplier</p><h1 className="mt-2 text-3xl font-semibold md:text-4xl">{supplier.business?.name || "Supplier onboarding"}</h1></div>
      <span className="rounded-full bg-black/[.05] px-3 py-1.5 text-xs capitalize">{status.replaceAll("_", " ")}</span>
    </div>
    <p className="mt-3 max-w-2xl text-black/55">One step at a time. We will always show you the next thing to do.</p>

    {message && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">{message}</div>}

    {supplier.business && <>
      <section className="mt-7 rounded-3xl border border-black/10 bg-black/[.025] p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Do this next</p><h2 className="mt-2 text-2xl font-semibold">{nextStep.title}</h2><p className="mt-2 text-sm leading-6 text-black/55">{nextStep.body}</p><Link href={nextStep.href} className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">{nextStep.cta} →</Link></div>
          <div className="min-w-44 rounded-2xl bg-white p-4 ring-1 ring-black/5"><div className="flex items-end justify-between gap-3"><div><div className="text-3xl font-semibold">{journeyPercent}%</div><div className="text-xs text-black/45">journey complete</div></div><div className="text-right text-xs text-black/45">Profile score<br/><strong className="text-sm text-black">{profilePercent}%</strong></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black" style={{ width: `${journeyPercent}%` }} /></div></div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Mini label="Completed" value={`${completeCount}/${steps.length}`} />
        <Mini label="Profile score" value={`${profilePercent}%`} />
        <Mini label="Status" value={status.replaceAll("_", " ")} />
      </div>

      <details className="mt-6 rounded-2xl border border-black/10 p-5">
        <summary className="cursor-pointer font-semibold">See full onboarding checklist</summary>
        <div className="mt-4 divide-y divide-black/10">{steps.map((step, index) => <div key={step.title} className="flex items-start gap-3 py-4"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-black text-white" : "bg-black/[.05] text-black/50"}`}>{step.complete ? "✓" : index + 1}</div><div className="min-w-0 flex-1"><h3 className="font-medium">{step.title}</h3><p className="mt-1 text-sm text-black/50">{step.body}</p></div>{!step.complete && <Link href={step.href} className="shrink-0 text-sm font-semibold">Open</Link>}</div>)}</div>
      </details>

      {!submitted && <section className="mt-6 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200"><h2 className="font-semibold">Your progress is saved</h2><p className="mt-1 text-sm leading-6 text-black/55">You can stop anytime. When you return, SafariPlug will bring you back to the first unfinished step.</p></section>}
      {submitted && !approved && <section className="mt-6 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200"><h2 className="font-semibold">Nothing else is required right now</h2><p className="mt-1 text-sm leading-6 text-black/55">Your profile is with SafariPlug for human review. We will tell you if anything needs to be changed.</p></section>}
    </>}
  </main>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-black/10 p-4"><p className="text-xs text-black/45">{label}</p><p className="mt-1 truncate font-semibold capitalize">{value}</p></div>; }
