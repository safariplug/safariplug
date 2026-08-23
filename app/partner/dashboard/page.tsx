"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PartnerDashboardPage() {

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
  });

  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadDashboard();
  }, []);


  async function loadDashboard() {

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (!user) {
      setLoading(false);
      return;
    }


    const {
      data: profile
    } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();


    if (profile) {
      setName(profile.full_name || "");
    }


    const {
      data: company
    } = await supabase
      .from("businesses")
      .select("name")
      .eq("owner_id", user.id)
      .single();


    if (company) {
      setBusiness(company.name);
    }


    const {
      data: events
    } = await supabase
      .from("events")
      .select("status")
      .eq("submitted_by", user.id);


    if (events) {

      setStats({

        total: events.length,

        approved:
          events.filter(
            (event) =>
              event.status === "approved"
          ).length,

        pending:
          events.filter(
            (event) =>
              event.status === "pending"
          ).length,

      });

    }


    setLoading(false);

  }


  if (loading) {

    return (

      <main className="min-h-screen flex items-center justify-center">
        Loading dashboard...
      </main>

    );

  }


  return (

    <main className="min-h-screen bg-slate-100 text-slate-900">


      <header className="border-b bg-white">

        <div className="mx-auto max-w-6xl px-6 py-5 flex justify-between items-center">

          <Link
            href="/"
            className="text-2xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>


          <Link
            href="/partner/events/create"
            className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white"
          >
            Create Experience
          </Link>

        </div>

      </header>



      <section className="mx-auto max-w-6xl px-6 py-10">


        <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
          Partner Portal
        </p>


        <h1 className="mt-3 text-4xl font-black">
          Welcome {name || "Partner"} 👋
        </h1>


        <p className="mt-3 text-slate-500">
          Manage your SafariPlug experiences and grow your audience.
        </p>



        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">

          <p className="text-sm font-bold text-slate-400">
            BUSINESS PROFILE
          </p>

          <h2 className="mt-2 text-2xl font-black">
            {business || "Business not added"}
          </h2>

          <p className="mt-2 text-slate-500">
            Your experiences appear on SafariPlug after approval.
          </p>

        </div>



        <div className="mt-8 grid gap-5 md:grid-cols-3">


          <div className="rounded-3xl bg-white p-6 shadow-sm">

            <p className="font-bold text-slate-400">
              TOTAL EXPERIENCES
            </p>

            <p className="mt-3 text-4xl font-black">
              {stats.total}
            </p>

          </div>



          <div className="rounded-3xl bg-white p-6 shadow-sm">

            <p className="font-bold text-slate-400">
              APPROVED
            </p>

            <p className="mt-3 text-4xl font-black text-green-600">
              {stats.approved}
            </p>

          </div>



          <div className="rounded-3xl bg-white p-6 shadow-sm">

            <p className="font-bold text-slate-400">
              PENDING REVIEW
            </p>

            <p className="mt-3 text-4xl font-black text-orange-500">
              {stats.pending}
            </p>

          </div>


        </div>



        <div className="mt-8 grid gap-4 md:grid-cols-2">


          <Link
            href="/partner/events"
            className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md"
          >

            <h3 className="text-xl font-black">
              My Experiences
            </h3>

            <p className="mt-2 text-slate-500">
              View and manage your submitted listings.
            </p>

          </Link>



          <Link
            href="/partner/events/create"
            className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md"
          >

            <h3 className="text-xl font-black">
              Add New Experience
            </h3>

            <p className="mt-2 text-slate-500">
              Submit a new event, activity or attraction.
            </p>

          </Link>


        </div>


      </section>


    </main>

  );

}