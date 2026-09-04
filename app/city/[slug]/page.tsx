import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

const cities: Record<
  string,
  {
    name: string;
    description: string;
  }
> = {
  nairobi: {
    name: "Nairobi",
    description:
      "Discover Nairobi events, nightlife, restaurants, adventures and unique experiences.",
  },

  mombasa: {
    name: "Mombasa",
    description:
      "Discover beach experiences, events, nightlife and things to do in Mombasa.",
  },

  diani: {
    name: "Diani",
    description:
      "Discover beach activities, restaurants, parties and coastal experiences in Diani.",
  },

  kilifi: {
    name: "Kilifi",
    description:
      "Discover festivals, beach experiences and hidden gems in Kilifi.",
  },

  zanzibar: {
    name: "Zanzibar",
    description:
      "Discover island experiences, beaches, culture and events in Zanzibar.",
  },
};


type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  venue_name: string | null;
  image_url: string | null;
};



export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {

  const { slug } = await params;

  const city = cities[slug];

  return {
    title: city
      ? `Things To Do In ${city.name} | SafariPlug`
      : "SafariPlug Experiences",

    description:
      city?.description ||
      "Discover experiences across East Africa.",
  };
}



export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {

  const { slug } = await params;

  const city = cities[slug];


  if (!city) {
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
      image_url
      `
    )
    .ilike("city", city.name)
    .eq("status", "approved")
    .or(effectiveValidityFilter)
    .order("created_at", {
      ascending: false,
    })
    .limit(24);


  const events = (data || []) as Event[];


  const faq = [
    {
      question: `What are the best things to do in ${city.name}?`,
      answer:
        `SafariPlug helps visitors discover events, experiences, nightlife, restaurants and activities in ${city.name}.`,
    },
    {
      question: `What events are happening in ${city.name}?`,
      answer:
        `Browse current ${city.name} experiences and events listed on SafariPlug.`,
    },
    {
      question: `Where can I find local experiences in ${city.name}?`,
      answer:
        `SafariPlug connects travelers and locals with verified experiences across East Africa.`,
    },
  ];


  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item)=>({
      "@type":"Question",
      name:item.question,
      acceptedAnswer:{
        "@type":"Answer",
        text:item.answer,
      },
    })),
  };


  return (

    <main className="min-h-screen bg-[#fffaf5] text-slate-950">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
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
          East Africa Experiences
        </p>


        <h1 className="mt-5 text-5xl font-black md:text-7xl">
          Things To Do In {city.name}
        </h1>


        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">
          {city.description}
        </p>



        <h2 className="mt-16 text-3xl font-black">
          Upcoming Experiences
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


                {event.venue_name && (
                  <p className="mt-3 text-sm text-slate-500">
                    📍 {event.venue_name}
                  </p>
                )}

              </div>


            </Link>

          ))}


        </div>



        <section className="mt-20 rounded-3xl bg-white p-8">

          <h2 className="text-3xl font-black">
            Frequently Asked Questions
          </h2>


          <div className="mt-6 space-y-6">

            {faq.map((item)=>(
              <div key={item.question}>

                <h3 className="font-black text-xl">
                  {item.question}
                </h3>

                <p className="mt-2 text-slate-600">
                  {item.answer}
                </p>

              </div>
            ))}

          </div>

                </section>



                <section className="mt-20">

          <h2 className="text-3xl font-black">
            Explore More East Africa Destinations
          </h2>

          <p className="mt-3 text-slate-600">
            Discover more events, activities and local experiences across East Africa.
          </p>


          <div className="mt-8 grid gap-5 md:grid-cols-5">

            {Object.entries(cities)
              .filter(([citySlug]) => citySlug !== slug)
              .map(([citySlug, destination]) => (
                
                <Link
                  key={citySlug}
                  href={`/city/${citySlug}`}
                  className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-xl"
                >

                  <h3 className="text-xl font-black">
                    {destination.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Things to do, events and experiences
                  </p>

                </Link>

              ))}

          </div>

                </section>


      </section>


    </main>

  );
}