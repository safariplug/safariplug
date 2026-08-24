export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function AdminDashboard() {
  const { data: events } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("id,status,city");

  const allEvents = events || [];

  const total = allEvents.length;

  const pending = allEvents.filter(
    (event) => event.status === "pending_review"
  ).length;

  const published = allEvents.filter(
    (event) => event.status === "approved"
  ).length;

  const cities = new Set(
    allEvents
      .map((event) => event.city)
      .filter(Boolean)
  ).size;


  return (
    <main className="min-h-screen bg-[#f7f5f0] text-slate-950">

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">
              SafariPlug Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Admin Command Center
            </h1>

            <p className="mt-2 text-slate-500">
              Manage discovery, publishing and platform growth.
            </p>
          </div>

          <Link
            href="/"
            target="_blank"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            View Platform
          </Link>

        </div>
      </header>


      <div className="mx-auto max-w-7xl px-6 py-10">


        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">

          <Metric
            title="AI Discoveries"
            value={total}
            text="Total events discovered"
          />

          <Metric
            title="Needs Review"
            value={pending}
            text="Awaiting approval"
            orange
          />

          <Metric
            title="Published"
            value={published}
            text="Live experiences"
            green
          />

          <Metric
            title="Cities"
            value={cities}
            text="Locations covered"
          />

        </section>



        <section className="mt-12">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">
            Operations
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Platform Modules
          </h2>


          <div className="mt-6 grid gap-5 md:grid-cols-2">


            <AdminCard
              href="/admin/ai-scout"
              title="AI Scout"
              description="Discover new events and experiences across East Africa."
            />


            <AdminCard
              href="/admin/ai-events"
              title="AI Events Review"
              description="Review, approve and publish AI discoveries."
            />


            <AdminCard
              href="/admin/marketing"
              title="Marketing"
              description="Manage campaigns, content and promotion."
            />


            <AdminCard
              href="/partner/dashboard"
              title="Partner Management"
              description="Manage businesses, venues and experience providers."
            />


          </div>

        </section>


        <section className="mt-12 rounded-[32px] bg-slate-950 p-8 text-white">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">
            SafariPlug AI Pipeline
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Discover → Verify → Approve → Publish
          </h2>

          <p className="mt-3 max-w-2xl text-slate-300">
            AI finds experiences. Human review protects quality.
            Approved discoveries become part of SafariPlug.
          </p>

        </section>


      </div>

    </main>
  );
}



function Metric({
  title,
  value,
  text,
  orange,
  green,
}: {
  title:string;
  value:number;
  text:string;
  orange?:boolean;
  green?:boolean;
}) {

  return (

    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">

      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {title}
      </p>

      <p
        className={`mt-4 text-5xl font-black ${
          orange
            ? "text-orange-500"
            : green
            ? "text-emerald-600"
            : "text-slate-950"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm font-bold text-slate-400">
        {text}
      </p>

    </div>

  );
}



function AdminCard({
  href,
  title,
  description,
}: {
  href:string;
  title:string;
  description:string;
}) {

  return (

    <Link
      href={href}
      className="group rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >

      <h3 className="text-2xl font-black group-hover:text-orange-500">
        {title}
      </h3>

      <p className="mt-3 leading-6 text-slate-500">
        {description}
      </p>

      <p className="mt-6 text-sm font-black text-orange-500">
        Open Module →
      </p>

    </Link>

  );

}