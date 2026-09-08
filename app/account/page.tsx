import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-emerald-700">SafariPlug</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">My SafariPlug</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Keep your trips, bookings, appointments, and food orders together in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AccountCard
          href="/trips"
          title="My trips"
          description="Open your itineraries and see the experiences, hotels, and plans attached to each trip."
        />
        <AccountCard
          href="/account/orders"
          title="Food orders"
          description="Track restaurant orders, delivery progress, drivers, and completed deliveries."
        />
        <AccountCard
          href="/hotels"
          title="Hotels"
          description="Search stays and return to your hotel booking flow."
        />
        <AccountCard
          href="/services"
          title="Services & appointments"
          description="Find barbers, massage, beauty, wellness, tattoo, nails, and other local services."
        />
        <AccountCard
          href="/events"
          title="Events"
          description="Discover events and manage experiences you have added to your plans."
        />
      </div>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="font-semibold">Need help planning?</h2>
        <p className="mt-1 text-sm text-neutral-600">
          SafariPlug Concierge can help find a service, check availability, and guide you through booking.
        </p>
        <Link
          href="/concierge"
          className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Ask Concierge
        </Link>
      </section>
    </main>
  );
}

function AccountCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold">{title}</h2>
        <span aria-hidden className="text-neutral-400 transition group-hover:translate-x-1">
          →
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
    </Link>
  );
}
