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

type Step = {
  title: string;
  body: string;
  href: string;
  cta: string;
  complete: boolean;
};

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
    const hasProfileImages = Boolean(business.logo_url || business.cover_image_url || (Array.isArray(business.supplier_gallery_urls) && business.supplier_gallery_urls.length));
    const offeringsReady = !isAppointment || Boolean(supplier.offerings?.length);
    const teamReady = !isAppointment || Boolean(supplier.staff?.length);
    const availabilityReady = !isAppointment || Boolean(supplier.availability?.length);

    const categorySetup = isRestaurant
      ? { title: "Menu & ordering setup", body: "Configure the restaurant tools customers will use after approval.", href: "/supplier/restaurant", cta: "Continue restaurant setup" }
      : isHotel
        ? { title: "Property & booking setup", body: "Complete your property readiness and booking setup.", href: "/supplier/hotel", cta: "Continue hotel setup" }
        : isEvents
          ? { title: "Events & experiences setup", body: "Prepare your organizer profile and listings for SafariPlug review.", href: "/supplier/events", cta: "Continue event setup" }
          : { title: "Services & pricing", body: "Add at least one service with pricing and duration.", href: "/supplier/onboarding", cta: "Add services" };

    const list: Step[] = [
      { title: "Business basics", body: "Add your business name, description, address and a working contact channel.", href: "/supplier/onboarding", cta: "Complete business details", complete: businessBasics },
      { title: "Business images", body: "Add a logo, cover image or gallery photo so customers can recognize your business.", href: "/supplier/onboarding", cta: "Add business images", complete: hasProfileImages },
      { ...categorySetup, complete: offeringsReady },
    ];

    if (isAppointment) {
      list.push(
        { title: "Team", body: "Add the people who will deliver your services.", href: "/supplier/onboarding", cta: "Add your team", complete: teamReady },
        { title: "Availability", body: "Set at least one working-time slot so SafariPlug knows when customers can book.", href: "/supplier/onboarding", cta: "Set availability", complete: availabilityReady },
      );
    }

    list.push({
      title: submitted ? (approved ? "Approved" : "SafariPlug review") : "Submit for review",
      body: submitted ? (approved ? "Your supplier profile has been approved." : "Your profile has been submitted. SafariPlug will review it before activation.") : "When your profile reaches the submission threshold, send it to SafariPlug for human review.",
      href: "/supplier/onboarding",
      cta: submitted ? "View submission" : "Review and submit",
      complete: submitted,
    });

    return list;
  }, [supplier, isAppointment, isRestaurant, isHotel, isEvents, submitted, approved]);

  const nextStep = steps.find((step) => !step.complete) || steps[steps.length - 1];
  const completeCount = steps.filter((step) => step.complete).length;
  const journeyPercent = steps.length ? Math.round((completeCount / steps.length) * 100) : 0;
  const recordedPercent = Number(supplier.account?.completion_percent || 0);

  if (!supplier.business && !message) {
    return <main className="mx-auto max-w-5xl px-6 py-16"><h1 className="text-3xl font-semibold">Supplier Portal</h1><p className="mt-3 text-black/60">Loading your onboarding journey…</p></main>;
  }

  return <main className="mx-auto max-w-5xl px-6 py-12">
    <p className="text-sm uppercase tracking-[.2em] text-black/40">SafariPlug Supplier</p>
    <h1 className="mt-2 text-4xl font-semibold">{supplier.business?.name ? `Welcome, ${supplier.business.name}` : "Supplier onboarding"}</h1>
    <p className="mt-3 max-w-2xl text-black/60">You do not need to search for what to do next. SafariPlug will keep your place and guide you through one step at a time.</p>

    {message && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">{message}</div>}

    {supplier.business && <>
      <section className="mt-8 rounded-3xl border border-black/10 bg-black/[.025] p-6 md:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-black/40">Continue onboarding</p>
            <h2 className="mt-2 text-2xl font-semibold">{nextStep.title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/55">{nextStep.body}</p>
            <Link href={nextStep.href} className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">{nextStep.cta} →</Link>
          </div>
          <div className="min-w-40 rounded-2xl bg-white p-4 text-right shadow-sm ring-1 ring-black/5">
            <div className="text-3xl font-semibold">{completeCount}/{steps.length}</div>
            <div className="mt-1 text-xs text-black/45">steps complete</div>
            <div className="mt-3 text-xs text-black/45">Profile score {recordedPercent}%</div>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black transition-all" style={{ width: `${journeyPercent}%` }} /></div>
        <p className="mt-2 text-xs text-black/40">{journeyPercent}% of the guided onboarding journey complete</p>
      </section>

      <section className="mt-7 rounded-3xl border border-black/10 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[.18em] text-black/40">Your onboarding checklist</p><h2 className="mt-1 text-xl font-semibold">What happens next</h2></div>
          <span className="rounded-full bg-black/[.05] px-3 py-1 text-xs capitalize">{status.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-5 divide-y divide-black/10">
          {steps.map((step, index) => <div key={step.title} className="flex items-start gap-4 py-4">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-black text-white" : step === nextStep ? "border-2 border-black text-black" : "bg-black/[.05] text-black/40"}`}>{step.complete ? "✓" : index + 1}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{step.title}</h3>{step === nextStep && !step.complete && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Do this next</span>}</div><p className="mt-1 text-sm text-black/50">{step.body}</p></div>
            {!step.complete && <Link href={step.href} className="hidden shrink-0 text-sm font-semibold underline-offset-4 hover:underline sm:block">Open</Link>}
          </div>)}
        </div>
      </section>

      {!submitted && <section className="mt-7 rounded-2xl border border-amber-300/60 bg-amber-50 p-5"><h2 className="font-semibold">You can leave and come back anytime</h2><p className="mt-1 text-sm leading-6 text-black/55">Your saved supplier information stays connected to your account. The next time you sign in, this page will point you to the first unfinished step.</p></section>}

      {submitted && !approved && <section className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Submitted for SafariPlug review</h2><p className="mt-1 text-sm leading-6 text-black/55">There is nothing else you need to hunt for right now. SafariPlug will review the submission and request changes if anything is missing.</p></section>}
    </>}
  </main>;
}
