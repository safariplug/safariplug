import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import BusinessNotificationInbox from "./BusinessNotificationInbox";

export const dynamic = "force-dynamic";

export default async function BusinessNotificationsPage(){
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.is_anonymous||!(user.email_confirmed_at||user.phone_confirmed_at)){
    redirect("/login?next=/business/notifications");
  }

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <header className="border-b border-black/8 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 sm:px-10">
        <div><Link href="/" className="text-sm font-semibold">SafariPlug</Link><p className="mt-1 text-[10px] uppercase tracking-[.25em] text-black/35">Partner notifications</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/business/services" className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold">Services</Link><Link href="/business/payouts" className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">Earnings & payouts</Link></div>
      </div>
    </header>
    <section className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-black/40">Inbox</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Service, finance and payout updates.</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-black/50">SafariPlug records appointment changes, paid cancellation review updates and provider payout status here. This inbox reflects recorded system state; it does not mean money has moved until the payout or refund status says so.</p>
      <BusinessNotificationInbox/>
    </section>
  </main>;
}
