import Link from "next/link";

const destinations = [
  { href: "/events", label: "Events", icon: "◉" },
  { href: "/experiences", label: "Experiences", icon: "✦" },
  { href: "/drivers", label: "Drivers", icon: "↗" },
  { href: "/locals", label: "Locals", icon: "◎" },
  { href: "/hotels", label: "Stays", icon: "⌂" },
  { href: "/services", label: "Services", icon: "◇" },
  { href: "/concierge", label: "Ask Concierge", icon: "⌕" },
];

export default function DiscoverySwitcher({ current }: { current?: string }) {
  return (
    <nav aria-label="Explore SafariPlug" className="overflow-x-auto border-y border-black/8 bg-white/90 px-5 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex w-max min-w-full max-w-7xl gap-2 md:w-auto">
        {destinations.map((item) => {
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-black bg-black text-white" : "border-black/10 bg-[#f7f7f4] text-black/60 hover:border-black/25 hover:text-black"}`}
            >
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
