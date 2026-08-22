import Link from "next/link";

type City = {
  name: string;
  country: string;
};

type Event = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  start_at: string;
  venue_name?: string | null;
  venue_address?: string | null;
  price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  featured?: boolean | null;
  city?: City | null;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(date));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  }).format(new Date(date));
}

function formatPrice(
  price: number | null | undefined,
  currency: string | null | undefined
) {
  if (price === null || price === undefined || price === 0) {
    return "Free";
  }

  return (currency || "KES") + " " + price.toLocaleString();
}

function categoryLabel(category: string) {
  switch (category) {
    case "Music & Nightlife":
      return "Music";

    case "Food & Drink":
      return "Food";

    case "Adventure":
      return "Adventure";

    case "Sports":
      return "Sports";

    case "Comedy":
      return "Comedy";

    case "Festivals":
      return "Festival";

    case "Culture & Arts":
      return "Arts";

    case "Safari & Wildlife":
      return "Safari";

    case "Water Activities":
      return "Water";

    case "Family":
      return "Family";

    case "Wellness":
      return "Wellness";

    case "Business":
      return "Business";

    case "Romantic":
      return "Romantic";

    default:
      return "Event";
  }
}

function isValidImageUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export default function EventCard({
  event,
}: {
  event: Event;
}) {
  const hasImage = isValidImageUrl(event.image_url);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">

      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-slate-950">

        {hasImage ? (
          <img
            src={event.image_url || ""}
            alt={event.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="rounded-full border border-slate-700 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-400">
              {categoryLabel(event.category)}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {event.featured && (
          <div className="absolute left-4 top-4 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm">
            Featured
          </div>
        )}

      </div>

      <div className="p-6">

        <div className="flex items-center justify-between gap-3">

          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-600">
            {event.category}
          </span>

          <span className="truncate text-xs font-semibold text-slate-400">
            {event.city?.name || "East Africa"}
          </span>

        </div>

        <h3 className="mt-4 text-xl font-black leading-tight text-slate-900">
          {event.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
          {event.description ||
            "Discover this event on SafariPlug."}
        </p>

        <div className="mt-5 flex gap-3">

          <div className="text-lg">
            Date
          </div>

          <div>
            <div className="text-sm font-bold text-slate-900">
              {formatDate(event.start_at)}
            </div>

            <div className="text-xs text-slate-500">
              {formatTime(event.start_at)}
            </div>
          </div>

        </div>

        <div className="mt-4 flex gap-3">

          <div className="text-lg">
            Venue
          </div>

          <div className="min-w-0">

            <div className="truncate text-sm font-bold text-slate-900">
              {event.venue_name ||
                "Venue to be announced"}
            </div>

            <div className="truncate text-xs text-slate-500">
              {event.venue_address ||
                (event.city
                  ? event.city.name +
                    ", " +
                    event.city.country
                  : "East Africa")}
            </div>

          </div>

        </div>

        <div className="mt-4 flex gap-3">

          <div className="text-lg">
            Price
          </div>

          <div className="text-sm font-bold text-slate-900">
            {formatPrice(
              event.price,
              event.currency
            )}
          </div>

        </div>

        <Link
          href={"/events/" + event.id}
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-orange-600"
        >
          View Event
        </Link>

      </div>

    </article>
  );
}

