export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import RunScoutButton from "./components/RunScoutButton";
import ScoutRunHistory from "./components/ScoutRunHistory";


export default async function AIScoutPage() {

  const supabase = await createSupabaseServerClient();


  const { data: runs } = await supabase
    .from("ai_scout_runs")
    .select("*")
    .order("created_at", {
      ascending: false,
    })
    .limit(10);



  const { data: discoveries } = await supabase
    .from("ai_discovered_events")
    .select(
      "id,title,status,source_name,confidence_score,created_at"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(10);



  const totalRuns = runs?.length || 0;


  const pending =
    discoveries?.filter(
      (item) =>
        item.status === "pending_review"
    ).length || 0;



  const approved =
    discoveries?.filter(
      (item) =>
        item.status === "approved"
    ).length || 0;



  const confidence =
    discoveries && discoveries.length
      ? Math.round(
          discoveries.reduce(
            (total, item) =>
              total +
              (item.confidence_score || 0),
            0
          ) / discoveries.length
        )
      : 0;



  return (

    <main className="min-h-screen bg-[#f5f1e8] text-[#17231d]">


      <header className="border-b bg-white">

        <div className="mx-auto max-w-7xl px-6 py-8">

          <Link
            href="/admin"
            className="text-sm font-bold text-gray-500"
          >
            ← Back to Admin
          </Link>


          <h1 className="mt-5 text-5xl font-black">
            SafariPlug AI Scout
          </h1>


          <p className="mt-3 text-gray-600">
            Discovery intelligence engine monitoring East Africa experiences.
          </p>

        </div>

      </header>



      <section className="mx-auto max-w-7xl px-6 py-10">



        <div className="grid gap-5 md:grid-cols-5">


          <Metric
            label="Scout Runs"
            value={totalRuns}
          />


          <Metric
            label="Discoveries"
            value={discoveries?.length || 0}
          />


          <Metric
            label="Pending Review"
            value={pending}
          />


          <Metric
            label="Approved"
            value={approved}
          />


          <Metric
            label="Confidence"
            value={`${confidence}%`}
          />


        </div>





        <div className="mt-10 rounded-3xl bg-white p-8 shadow-sm">


          <h2 className="text-3xl font-black">
            Scout Control
          </h2>


          <p className="mt-2 text-gray-600">
            Start a discovery run and send findings into human review.
          </p>



          <div className="mt-6 flex gap-4">

            <RunScoutButton />


            <Link
              href="/admin/ai-events?tab=pending"
              className="rounded-full bg-black px-6 py-3 font-bold text-white"
            >
              Review Queue
            </Link>


          </div>


        </div>





        <div className="mt-10 rounded-3xl bg-white p-8 shadow-sm">


          <h2 className="text-3xl font-black">
            Latest Discoveries
          </h2>



          <div className="mt-6 space-y-4">


            {discoveries?.map((item)=>(
              
              <div
                key={item.id}
                className="rounded-2xl bg-[#f5f1e8] p-5"
              >

                <h3 className="font-black">
                  {item.title}
                </h3>


                <p className="text-sm text-gray-600">
                  Source: {item.source_name || "Unknown"}
                </p>


                <p className="text-sm">
                  Status: {item.status}
                </p>


                <p className="text-sm">
                  Confidence: {item.confidence_score || 0}%
                </p>


              </div>

            ))}


          </div>


        </div>





        <div className="mt-10">

          <ScoutRunHistory
            runs={runs || []}
          />

        </div>




      </section>


    </main>

  );

}





function Metric({
  label,
  value,
}:{
  label:string;
  value:string|number;
}) {


  return (

    <div className="rounded-3xl bg-white p-6 shadow-sm">

      <p className="text-xs font-black uppercase tracking-widest text-gray-400">
        {label}
      </p>


      <p className="mt-3 text-3xl font-black">
        {value}
      </p>


    </div>

  );

}