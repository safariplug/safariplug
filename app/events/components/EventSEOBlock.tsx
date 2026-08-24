type EventSEOBlockProps = {
  category: string;
  venue: string | null;
  city: string | null;
  description: string | null;
};

export default function EventSEOBlock({
  category,
  venue,
  city,
  description,
}: EventSEOBlockProps) {
  return (
    <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm">

      <h2 className="text-3xl font-black">
        Why visit this experience?
      </h2>

      <div className="mt-6 space-y-5 text-slate-600">

        <div>
          <h3 className="font-black text-slate-950">
            Experience type
          </h3>
          <p>
            {category} experience in East Africa.
          </p>
        </div>


        <div>
          <h3 className="font-black text-slate-950">
            Location
          </h3>
          <p>
            {venue || "Discover this experience location"}
            {city ? `, ${city}` : ""}
          </p>
        </div>


        <div>
          <h3 className="font-black text-slate-950">
            Perfect for
          </h3>
          <p>
            Travellers, locals, families, couples and anyone looking for memorable things to do.
          </p>
        </div>


        <div>
          <h3 className="font-black text-slate-950">
            SafariPlug recommendation
          </h3>
          <p>
            {description ||
              "A curated East African experience discovered through SafariPlug."}
          </p>
        </div>

      </div>

    </section>
  );
}