import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";


const categories: Record<
  string,
  {
    name: string;
    description: string;
  }
> = {

  nightlife: {
    name: "Nightlife",
    description:
      "Discover nightlife, parties, clubs, bars and evening experiences across East Africa.",
  },

  beaches: {
    name: "Beach Experiences",
    description:
      "Discover beaches, coastal adventures, water activities and seaside experiences.",
  },

  safari: {
    name: "Safari Experiences",
    description:
      "Discover wildlife adventures, nature experiences and unforgettable safaris.",
  },

  food: {
    name: "Food & Dining",
    description:
      "Discover restaurants, food experiences, tastings and culinary adventures.",
  },

  "date-night": {
    name: "Date Night",
    description:
      "Discover romantic restaurants, activities and memorable experiences for couples.",
  },

  "live-music": {
    name: "Live Music",
    description:
      "Discover concerts, performances and live entertainment experiences.",
  },

  "hidden-gems": {
    name: "Hidden Gems",
    description:
      "Discover unique local experiences and places worth exploring.",
  },

};



type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  city: string | null;
  venue_name: string | null;
  image_url: string | null;
};

type EventRow = Event & {
  cities?: { name?: string | null } | { name?: string | null }[] | null;
};

function cityNameFromRelation(cities: EventRow["cities"]): string | null {
  const row = Array.isArray(cities) ? cities[0] : cities;
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  return name || null;
}



export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {

  const { slug } = await params;

  const category = categories[slug];


  return {

    title: category
      ? `${category.name} Experiences in East Africa | SafariPlug`
      : "SafariPlug Experiences",

    description:
      category?.description ||
      "Discover experiences across East Africa.",

  };

}



export default async function ExperienceCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {


  const { slug } = await params;


  const category = categories[slug];


  if (!category) {
    notFound();
  }

  const now = new Date().toISOString();
  const effectiveValidityFilter = `end_at.gte.${now},and(end_at.is.null,start_at.gte.${now})`;

  const { data } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      description,
      category,
      venue_name,
      image_url,
      cities ( name )
      `
    )
    .ilike("category", `%${category.name}%`)
    .eq("status", "approved")
    .or(effectiveValidityFilter)
    .order("created_at", {
      ascending:false,
    })
    .limit(30);



  const events = ((data || []) as EventRow[]).map((row) => ({
    ...row,
    city: cityNameFromRelation(row.cities),
  }));



  const schema = {

    "@context":"https://schema.org",

    "@type":"CollectionPage",

    name: category.name,

    description: category.description,

  };



  return (

    <main className="min-h-screen bg-[#fffaf5] text-slate-950">


      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema),
        }}
      />


      <header className="border-b bg-white">

        <div className="mx-auto max-w-7xl px-6 py-6">

          <Link
            href="/"
            className="text-3xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

        </div>

      </header>



      <section className="mx-auto max-w-7xl px-6 py-16">


        <p className="font-black uppercase tracking-widest text-orange-500">
          Experiences
        </p>


        <h1 className="mt-5 text-5xl font-black md:text-7xl">
          {category.name} Experiences Across East Africa
        </h1>


        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">
          {category.description}
        </p>



        <h2 className="mt-16 text-3xl font-black">
          Discover Experiences
        </h2>



        <div className="mt-8 grid gap-8 md:grid-cols-3">


          {events.map((event)=>(

            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-xl"
            >

              {event.image_url && (

                <img
                  src={event.image_url}
                  alt={event.title}
                  className="h-56 w-full object-cover"
                />

              )}


              <div className="p-6">


                <span className="text-sm font-black text-orange-500">
                  {event.category}
                </span>


                <h3 className="mt-3 text-2xl font-black">
                  {event.title}
                </h3>


                {event.city && (

                  <p className="mt-3 text-sm text-slate-500">
                    📍 {event.city}
                  </p>

                )}


              </div>


            </Link>

          ))}


        </div>


      </section>


    </main>

  );
}
