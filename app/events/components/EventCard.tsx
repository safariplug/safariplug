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

function fallbackImage(category: string) {
  switch (category) {
    case "Music & Nightlife":
      return "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85";

    case "Food & Drink":
      return "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85";

    case "Safari & Wildlife":
      return "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=85";

    case "Water Activities":
      return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85";

    case "Adventure":
      return "https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=1200&q=85";

    default:
      return "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=85";
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

function eventBadge(date: string) {
  const eventDate = new Date(date);
  const now = new Date();

  const eventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return "Tonight";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  if (diffDays >= 2 && diffDays <= 6) {
    return "This Week";
  }

  return "Upcoming";
}

export default function EventCard({
  event,
}: {
  event: Event;
}) {
  const imageSource = isValidImageUrl(event.image_url)
    ? event.image_url || fallbackImage(event.category)
    : fallbackImage(event.category);

  const timingBadge = eventBadge(event.start_at);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl">

      <div className="relative h-64 overflow-hidden bg-slate-950">

        <img
          src={imageSource}
          alt={event.title}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">

          <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-lg backdrop-blur">
            {categoryLabel(event.category)}
          </span>

          {event.featured && (
  <span className="rounded-full bg-orange-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
    ★ Featured
  </span>
)}

        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
              {event.city?.name || "East Africa"}
            </div>

            <div className="mt-1 text-sm font-bold text-white">
              {timingBadge}
            </div>
          </div>

          <span className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
            SafariPlug
          </span>

        </div>

      </div>

      <div className="p-6">

        <div className="flex items-center gap-2">

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
            ✓ Verified
          </span>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            ✦ Discovery
          </span>

        </div>

        <h3 className="mt-4 text-xl font-black leading-tight text-slate-900">
          {event.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
          {event.description ||
            "Discover this event on SafariPlug."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Date
            </div>

            <div className="mt-1 text-sm font-bold text-slate-900">
              {formatDate(event.start_at)}
            </div>

            <div className="mt-0.5 text-xs font-medium text-slate-500">
              {formatTime(event.start_at)}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Price
            </div>

            <div className="mt-1 text-sm font-bold text-slate-900">
              {formatPrice(
                event.price,
                event.currency
              )}
            </div>
          </div>

        </div>

        <div className="mt-5">

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Venue
          </div>

          <div className="mt-1 truncate text-sm font-bold text-slate-900">
            {event.venue_name ||
              "Venue to be announced"}
          </div>

          <div className="mt-0.5 truncate text-xs text-slate-500">
            {event.venue_address ||
              (event.city
                ? event.city.name +
                  ", " +
                  event.city.country
                : "East Africa")}
          </div>

        </div>

        <Link
          href={"/events/" + event.id}
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 hover:shadow-lg"
        >
          View Event →
        </Link>

      </div>

    </article>
  );
}

