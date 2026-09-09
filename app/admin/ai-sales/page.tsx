import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runSalesScout } from "./actions/run-sales-scout";

const cities = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Kilifi",
  "Malindi",
  "Watamu",
  "Lamu",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam",
  "Accra",
  "Lagos",
  "Cape Town",
  "Johannesburg",
  "Cairo",
  "Casablanca",
];

const categories = [
  "Barbers",
  "Hair & Beauty",
  "Spas & Massage",
  "Tattoo Artists & Body Art",
  "Nails",
  "Lashes & Brows",
  "Fitness & Personal Training",
  "Yoga/Pilates/Mindfulness",
  "Diving & Marine",
  "Surfing & Board Sports",
  "Water Sports & Kite",
  "Tours & Local Guides",
  "Photography & Content",
  "Private Chefs & Cooking",
  "Hotels",
  "Restaurants",
  "Nightlife",
  "Tour Operators",
  "Experiences",
];

export default async function AISalesPage() {
  async function runScout(formData: FormData): Promise<void> {
    await runSalesScout(formData);
  }

  const { count: total } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*", { count: "exact", head: true });

  const { count: pending } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "pending_review");

  const { count: rejected } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "rejected");

  const { count: partners } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("*", { count: "exact", head: true })
    .eq("status", "partner");

  const { data: prospects } = await supabaseAdmin
    .from("ai_sales_prospects")
    .select("id,business_name,category,city,opportunity_score,status,review_status")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← Back to Admin
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-8 shadow">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold">SafariPlug AI Sales Agent</h1>
              <p className="mt-2 text-gray-600">
                Supplier discovery and partnership intelligence for businesses across Africa.
              </p>
            </div>
            <Link href="/admin/ai-sales/partners" className="rounded-xl bg-black px-5 py-3 text-white">
              Partners →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border p-5"><p>Prospects</p><p className="text-3xl font-bold">{total ?? 0}</p></div>
            <div className="rounded-xl border p-5"><p>Pending Review</p><p className="text-3xl font-bold">{pending ?? 0}</p></div>
            <div className="rounded-xl border p-5"><p>Rejected</p><p className="text-3xl font-bold">{rejected ?? 0}</p></div>
            <div className="rounded-xl border p-5"><p>Partners</p><p className="text-3xl font-bold">{partners ?? 0}</p></div>
          </div>

          <section className="mt-10 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Africa Supplier Scout</h2>
            <p className="mt-2 text-gray-600">
              Find real service providers and hospitality businesses across Africa. Discovery only: results are reviewed before outreach.
            </p>

            <form action={runScout} className="mt-6 grid gap-4 md:grid-cols-3">
              <select name="city" defaultValue="Nairobi" className="rounded-xl border p-3">
                {cities.map((city) => <option key={city}>{city}</option>)}
              </select>

              <select name="category" defaultValue="Barbers" className="rounded-xl border p-3">
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>

              <button type="submit" className="rounded-xl bg-black px-6 py-3 font-bold text-white">
                Run Supplier Scout
              </button>
            </form>
          </section>

          <section className="mt-10 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">Prospect Feed</h2>
            <div className="mt-5 space-y-4">
              {prospects?.map((prospect) => (
                <div key={prospect.id} className="rounded-xl border p-5">
                  <h3 className="text-lg font-bold">{prospect.business_name}</h3>
                  <p className="text-gray-600">{prospect.city} · {prospect.category}</p>
                  <p className="mt-2">Opportunity Score: <b>{prospect.opportunity_score ?? 0}%</b></p>
                  <p>Status: {prospect.status}</p>
                  <p>Review: {prospect.review_status}</p>
                  <div className="mt-3">
                    <Link href={`/admin/ai-sales/edit/${prospect.id}`} className="text-blue-600 hover:underline">
                      {prospect.status === "partner" ? "View Partner →" : prospect.review_status === "rejected" ? "View Archived →" : "Review Prospect →"}
                    </Link>
                    {prospect.status === "partner" ? (
                      <Link href="/admin/ai-sales/partners" className="ml-4 text-green-600 hover:underline">Manage Relationship →</Link>
                    ) : prospect.review_status !== "rejected" ? (
                      <Link href={`/admin/ai-sales/outreach?prospect=${prospect.id}`} className="ml-4 text-green-600 hover:underline">Generate Outreach →</Link>
                    ) : null}
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
