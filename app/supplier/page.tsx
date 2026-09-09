"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Supplier = { business?: Record<string, any>; account?: Record<string, any>; profile?: Record<string, any> | null };

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

  const type = supplier.business?.business_type || "";
  const isRestaurant = type === "Restaurant";
  const isHotel = type === "Hotel";
  const isEvents = type === "Event Organizer";
  const isAppointment = Boolean(supplier.profile) && !isRestaurant && !isHotel && !isEvents;

  const primary = isRestaurant
    ? { href: "/supplier/restaurant", title: "Menu & ordering", body: "Manage your menu, fulfillment methods, delivery pricing and restaurant orders." }
    : isHotel
      ? { href: "/supplier/hotel", title: "Property & booking", body: "Complete your property profile and prepare your hotel for booking connectivity." }
      : isEvents
        ? { href: "/supplier/events", title: "Events & experiences", body: "Prepare your organizer profile and event listings for SafariPlug curation." }
        : { href: "/supplier/onboarding", title: "Services & bookings", body: "Manage services, pricing, staff, availability and customer bookings." };

  if (!supplier.business && !message) return <main className="mx-auto max-w-5xl px-6 py-16"><h1 className="text-3xl font-semibold">Supplier Portal</h1><p className="mt-3 text-black/60">Loading your workspace…</p></main>;

  return <main className="mx-auto max-w-5xl px-6 py-12">
    <p className="text-sm uppercase tracking-[.2em] text-black/40">SafariPlug</p>
    <h1 className="mt-2 text-4xl font-semibold">Supplier Portal</h1>
    <p className="mt-3 max-w-2xl text-black/60">{supplier.business?.name ? `Welcome to ${supplier.business.name}. Your workspace is tailored to your business type.` : "Manage your SafariPlug supplier account."}</p>

    {message && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">{message}</div>}

    {supplier.business && <>
      <section className="mt-8 rounded-2xl border border-black/10 bg-black/[.02] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[.18em] text-black/40">{type || "Supplier"}</p><h2 className="mt-1 text-2xl font-semibold">Your workspace</h2><p className="mt-2 text-sm text-black/55">{primary.body}</p></div>
          <span className="rounded-full bg-black/[.05] px-3 py-1 text-xs">{supplier.account?.onboarding_status || "draft"}</span>
        </div>
        <Link href={primary.href} className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm text-white">Open {primary.title}</Link>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/supplier/onboarding" className="rounded-2xl border border-black/10 p-5 transition hover:bg-black/[.03]"><h3 className="font-semibold">Business profile</h3><p className="mt-2 text-sm text-black/50">Business details, images, contact information and onboarding.</p></Link>
        {!isRestaurant && !isHotel && !isEvents && <Link href="/supplier/calendar" className="rounded-2xl border border-black/10 p-5 transition hover:bg-black/[.03]"><h3 className="font-semibold">Availability calendar</h3><p className="mt-2 text-sm text-black/50">Set working hours, block time and manage appointments.</p></Link>}
        {isRestaurant && <Link href="/supplier/restaurant-orders" className="rounded-2xl border border-black/10 p-5 transition hover:bg-black/[.03]"><h3 className="font-semibold">Restaurant orders</h3><p className="mt-2 text-sm text-black/50">Accept orders, manage kitchen status and hand orders to delivery.</p></Link>}
        {isHotel && <Link href="/supplier/hotel" className="rounded-2xl border border-black/10 p-5 transition hover:bg-black/[.03]"><h3 className="font-semibold">Hotel workspace</h3><p className="mt-2 text-sm text-black/50">Property readiness and booking connectivity.</p></Link>}
        {isEvents && <Link href="/supplier/events" className="rounded-2xl border border-black/10 p-5 transition hover:bg-black/[.03]"><h3 className="font-semibold">Event workspace</h3><p className="mt-2 text-sm text-black/50">Organizer readiness and curation workflow.</p></Link>}
        {isAppointment && <div className="rounded-2xl border border-black/10 p-5"><h3 className="font-semibold">Appointments</h3><p className="mt-2 text-sm text-black/50">Your services, staff and availability are managed through the onboarding and calendar tools.</p></div>}
      </div>
    </>}
  </main>;
}
