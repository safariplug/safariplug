"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CreateEventPage() {

  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    city_id: "",
    venue_name: "",
    venue_address: "",
    start_at: "",
    end_at: "",
    price: "",
    currency: "KES",
    booking_url: "",
    organizer_name: "",
    organizer_contact: "",
    image_url: "",
  });


  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    setLoading(true);
    setMessage("");


    try {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {
        throw new Error("Please login first.");
      }


      const {
        error
      } = await supabase
        .from("events")
        .insert({

          title: form.title,

          description: form.description,

          category: form.category,

          city_id: form.city_id,

          venue_name: form.venue_name,

          venue_address: form.venue_address,

          start_at: form.start_at,

          end_at: form.end_at || null,

          price: form.price
            ? Number(form.price)
            : null,

          currency: form.currency,

          booking_url: form.booking_url,

          organizer_name: form.organizer_name,

          organizer_contact: form.organizer_contact,

          image_url: form.image_url,
submitted_by: user.id,

          status: "pending",

        });


      if(error) {
        throw error;
      }


      setMessage(
        "Event submitted successfully. Waiting for approval."
      );


      setTimeout(() => {
        router.push("/partner/dashboard");
      }, 1500);


    } catch(err) {

      setMessage(
        err instanceof Error
        ? err.message
        : "Unable to submit event."
      );

    } finally {

      setLoading(false);

    }

  }



  return (

    <main className="min-h-screen bg-slate-100 text-slate-900">


      <header className="border-b bg-white">

        <div className="mx-auto max-w-6xl px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

        </div>

      </header>



      <section className="mx-auto max-w-3xl px-6 py-10">


        <div className="rounded-3xl bg-white p-8 shadow-sm">


          <p className="text-sm font-black uppercase tracking-widest text-orange-500">
            Partner Portal
          </p>


          <h1 className="mt-3 text-3xl font-black">
            Submit a New Experience
          </h1>


          <p className="mt-3 text-slate-500">
            Your event will be reviewed by SafariPlug before appearing publicly.
          </p>



          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4"
          >


            {[
              ["title","Event title"],
              ["venue_name","Venue name"],
              ["venue_address","Venue address"],
              ["organizer_name","Organizer name"],
              ["organizer_contact","WhatsApp contact"],
              ["booking_url","Booking URL"],
              ["image_url","Image URL"],
            ].map(([key,placeholder]) => (

              <input
                key={key}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e)=>
                  setForm({
                    ...form,
                    [key]: e.target.value
                  })
                }
                className="w-full rounded-xl border px-4 py-3"
              />

            ))}



            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e)=>
                setForm({
                  ...form,
                  description:e.target.value
                })
              }
              className="min-h-32 w-full rounded-xl border px-4 py-3"
            />



            <input
              placeholder="Category (Beach, Music, Food, Safari...)"
              value={form.category}
              onChange={(e)=>
                setForm({
                  ...form,
                  category:e.target.value
                })
              }
              className="w-full rounded-xl border px-4 py-3"
            />



            <input
              placeholder="City ID"
              value={form.city_id}
              onChange={(e)=>
                setForm({
                  ...form,
                  city_id:e.target.value
                })
              }
              className="w-full rounded-xl border px-4 py-3"
            />



            <label className="block text-sm font-bold">
              Start Date & Time
            </label>

            <input
              type="datetime-local"
              value={form.start_at}
              onChange={(e)=>
                setForm({
                  ...form,
                  start_at:e.target.value
                })
              }
              className="w-full rounded-xl border px-4 py-3"
            />


            <input
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e)=>
                setForm({
                  ...form,
                  price:e.target.value
                })
              }
              className="w-full rounded-xl border px-4 py-3"
            />


            {message && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold">
                {message}
              </div>
            )}


            <button
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 py-3 font-black text-white hover:bg-orange-600"
            >
              {loading
              ? "Submitting..."
              : "Submit Event"}

            </button>


          </form>


        </div>


      </section>


    </main>

  );

}