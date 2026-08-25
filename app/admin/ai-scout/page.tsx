import Link from "next/link";
import ScoutButton from "./ScoutButton";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function AIScoutPage() {

  const { count: total } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true });


  const { count: pending } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");


  const { count: approved } = await supabaseAdmin
    .from("ai_discovered_events")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");


  const { data: discoveries } = await supabaseAdmin
    .from("ai_discovered_events")
    .select(
      "id, title, city, venue_name, category, confidence_score, status, review_status"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(10);


  return (
    <main className="min-h-screen bg-gray-50 p-8">

      <div className="mx-auto max-w-6xl">

        <Link
          href="/admin"
          className="text-blue-600 hover:underline"
        >
          ← Back to Admin
        </Link>


        <div className="mt-6 rounded-2xl bg-white p-8 shadow">

          <h1 className="text-3xl font-bold">
            SafariPlug AI Scout
          </h1>

          <p className="mt-2 text-gray-600">
            Discovery intelligence engine monitoring East Africa experiences.
          </p>


          <div className="mt-8 grid gap-4 md:grid-cols-3">

            <div className="rounded-xl border p-5">
              <p>Discoveries</p>
              <p className="text-3xl font-bold">{total ?? 0}</p>
            </div>

            <div className="rounded-xl border p-5">
              <p>Pending Review</p>
              <p className="text-3xl font-bold">{pending ?? 0}</p>
            </div>

            <div className="rounded-xl border p-5">
              <p>Approved</p>
              <p className="text-3xl font-bold">{approved ?? 0}</p>
            </div>

          </div>


          <section className="mt-10 rounded-xl border p-6">

            <h2 className="text-xl font-semibold">
              Scout Mission Control
            </h2>

            <p className="mt-2 text-gray-600">
              Launch a discovery mission and send findings into review.
            </p>

            <ScoutButton />

          </section>



          <section className="mt-10 rounded-xl border p-6">

            <h2 className="text-xl font-semibold">
              Discovery Feed
            </h2>


            <div className="mt-5 space-y-4">


              {discoveries?.map((event) => (

                <div
                  key={event.id}
                  className="rounded-xl border p-4"
                >

                  <h3 className="font-bold">
                    {event.title}
                  </h3>


                  <p className="text-sm text-gray-600">
                    {event.city} · {event.venue_name}
                  </p>


                  <p className="text-sm">
                    {event.category}
                  </p>


                  <p className="text-sm">
                    Confidence: {event.confidence_score}%
                  </p>


                  <p className="text-sm">
                    Status: {event.status}
                  </p>


                  <p className="text-sm">
                    Review: {event.review_status}
                  </p>


                  <div className="mt-4 flex gap-3">


                    {event.status === "pending_review" && (
  <Link
    href={`/admin/ai-events/edit/${event.id}`}
    className="rounded-lg bg-orange-500 px-4 py-2 text-white"
  >
    Preview & Verify
  </Link>
)}
  
                     
                    


                    {event.status === "approved" && (
                      <form
                        action={`/api/admin/scout/publish/${event.id}`}
                        method="POST"
                      >
                        <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">
                          Publish to SafariPlug
                        </button>
                      </form>
                    )}


                  </div>


                </div>

              ))}


            </div>

          </section>


        </div>

      </div>

    </main>
  );
}