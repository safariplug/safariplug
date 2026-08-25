import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  approveSalesProspect,
  rejectSalesProspect,
} from "./actions";


export default async function SalesReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {

  const { id } = await params;


  const { data: prospect } =
    await supabaseAdmin
      .from("ai_sales_prospects")
      .select("*")
      .eq("id", id)
      .single();


  if (!prospect) {

    return (
      <div className="p-8">
        Prospect not found
      </div>
    );

  }


  const priority =
    prospect.opportunity_score >= 85
      ? "High"
      : prospect.opportunity_score >= 60
      ? "Medium"
      : "Low";


  return (

    <main className="min-h-screen bg-gray-50 p-8">

      <div className="mx-auto max-w-5xl">


        <Link
          href="/admin/ai-sales"
          className="text-blue-600 hover:underline"
        >
          ← Back to Sales
        </Link>



        <div className="mt-6 rounded-2xl bg-white p-8 shadow">


          <h1 className="text-3xl font-bold">
            {prospect.business_name}
          </h1>


          <p className="mt-2 text-gray-600">
            {prospect.city} · {prospect.category}
          </p>



          <div className="mt-8 grid gap-5 md:grid-cols-3">


            <div className="rounded-xl border p-5">

              <p className="text-gray-500">
                Opportunity Score
              </p>

              <p className="text-3xl font-bold">
                {prospect.opportunity_score}%
              </p>

            </div>



            <div className="rounded-xl border p-5">

              <p className="text-gray-500">
                Priority
              </p>

              <p className="text-3xl font-bold">
                {priority}
              </p>

            </div>



            <div className="rounded-xl border p-5">

              <p className="text-gray-500">
                Status
              </p>

              <p className="text-xl font-bold">
                {prospect.review_status}
              </p>

            </div>


          </div>




          <section className="mt-8 rounded-xl border p-6">


            <h2 className="text-xl font-bold">
              Partnership Intelligence
            </h2>


            <p className="mt-3 text-gray-700">

              SafariPlug fit:

              {" "}

              {prospect.opportunity_score >= 80
                ? "Strong partnership opportunity. High potential for discovery placement and traveler engagement."
                : "Potential partner. Requires further qualification."
              }

            </p>


          </section>





          <section className="mt-8 rounded-xl border p-6">


            <h2 className="text-xl font-bold">
              Business Information
            </h2>


            <div className="mt-4 space-y-3">


              <p>
                Website:
                {" "}
                {prospect.website || "Not available"}
              </p>


              <p>
                Instagram:
                {" "}
                {prospect.instagram || "Not available"}
              </p>


              <p>
                Facebook:
                {" "}
                {prospect.facebook || "Not available"}
              </p>


              <p>
                Contact:
                {" "}
                {prospect.contact_email || "Not available"}
              </p>


              <p>
                Phone:
                {" "}
                {prospect.phone || "Not available"}
              </p>


            </div>


          </section>






          <section className="mt-8 rounded-xl border p-6">


            <h2 className="text-xl font-bold">
              Suggested Outreach Angle
            </h2>


            <p className="mt-3 text-gray-700">

              "SafariPlug helps travelers discover the best
              experiences across East Africa. We would like
              to feature this business as a recommended
              experience partner."

            </p>


          </section>






          <div className="mt-8 flex gap-4">


            <form
              action={approveSalesProspect.bind(
                null,
                prospect.id
              )}
            >

              <button
                className="rounded-xl bg-green-600 px-6 py-3 text-white font-bold"
              >
                Approve Partner
              </button>

            </form>





            <form
              action={rejectSalesProspect.bind(
                null,
                prospect.id
              )}
            >

              <button
                className="rounded-xl bg-red-600 px-6 py-3 text-white font-bold"
              >
                Reject
              </button>

            </form>


          </div>



        </div>


      </div>


    </main>

  );

}