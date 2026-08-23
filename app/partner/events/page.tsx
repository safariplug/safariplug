"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EventItem = {
  id: string;
  title: string;
  category: string;
  venue_name: string | null;
  start_at: string;
  status: string;
  featured: boolean;
};

export default function PartnerEventsPage() {

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);


  async function loadEvents() {

    try {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {
        setMessage("Please login first.");
        return;
      }


      const {
        data,
        error
      } = await supabase
        .from("events")
        .select(`
          id,
          title,
          category,
          venue_name,
          start_at,
          status,
          featured
        `)
        .eq(
          "submitted_by",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );


      if (error) throw error;


      setEvents(data || []);


    } catch (error) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load events."
      );

    } finally {

      setLoading(false);

    }

  }


  function statusStyle(status: string) {

    if (status === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";

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


        <h1 className="text-4xl font-black">
          My Experiences
        </h1>


        <p className="mt-3 text-slate-500">
          Manage your events and experiences listed on SafariPlug.
        </p>



        {message && (

          <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
            {message}
          </div>

        )}



        {loading ? (

          <div className="mt-10 rounded-3xl bg-white p-10 text-center">
            Loading experiences...
          </div>

        ) : events.length === 0 ? (

          <div className="mt-10 rounded-3xl bg-white p-10 text-center">

            <h2 className="text-2xl font-black">
              No experiences yet
            </h2>

            <p className="mt-3 text-slate-500">
              Start by creating your first SafariPlug listing.
            </p>

          </div>


        ) : (


          <div className="mt-8 space-y-5">

            {events.map((event) => (

              <div
                key={event.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >

                <div className="flex flex-col gap-4 md:flex-row md:justify-between">


                  <div>

                    <h2 className="text-2xl font-black">
                      {event.title}
                    </h2>


                    <p className="mt-2 text-slate-500">
                      {event.category}
                      {" · "}
                      {event.venue_name || "Venue not added"}
                    </p>


                    <span
                      className={`mt-4 inline-block rounded-full px-4 py-2 text-xs font-black uppercase ${statusStyle(event.status)}`}
                    >
                      {event.status}
                    </span>


                  </div>



                  <div>

                    {event.status === "approved" && (

                      <Link
                        href={`/events/${event.id}`}
                        className="rounded-xl border px-5 py-3 font-bold"
                      >
                        View Listing
                      </Link>

                    )}

                  </div>


                </div>


              </div>

            ))}

          </div>

        )}


      </section>


    </main>

  );

}