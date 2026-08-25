import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function PartnersPage() {

  const { data: partners } =
    await supabaseAdmin
      .from("ai_sales_prospects")
      .select(
        `
        id,
        business_name,
        category,
        city,
        website,
        instagram,
        opportunity_score,
        status,
        review_status
        `
      )
      .eq(
        "status",
        "partner"
      )
      .eq(
        "review_status",
        "approved"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


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
            SafariPlug Partner Pipeline
          </h1>


          <p className="mt-2 text-gray-600">
            Approved businesses ready for partnership outreach.
          </p>



          <div className="mt-8 space-y-5">


            {(!partners || partners.length === 0) && (

              <p className="text-gray-500">
                No approved partners yet.
              </p>

            )}



            {partners?.map((partner) => (

              <div
                key={partner.id}
                className="rounded-xl border p-6"
              >

                <h2 className="text-xl font-bold">
                  {partner.business_name}
                </h2>


                <p className="text-gray-600">
                  {partner.city} · {partner.category}
                </p>


                <p className="mt-3">
                  Opportunity Score:
                  {" "}
                  <b>
                    {partner.opportunity_score}%
                  </b>
                </p>


                <p>
                  Status:
                  {" "}
                  {partner.status}
                </p>


                <p>
                  Website:
                  {" "}
                  {partner.website || "Not available"}
                </p>


                <p>
                  Instagram:
                  {" "}
                  {partner.instagram || "Not available"}
                </p>


                <Link
                  href={`/admin/ai-sales/edit/${partner.id}`}
                  className="mt-4 inline-block text-blue-600 hover:underline"
                >
                  Open Partner Profile →
                </Link>


              </div>

            ))}


          </div>


        </div>

      </div>

    </main>

  );
}