import Link from "next/link";

const partnerTypes = [
  { title: "Services & personal care", examples: "Massage, barber, nails, beauty, tattoo, wellness, fitness", href: "/login?next=/business/services&as=partner", status: "Onboarding available" },
  { title: "Restaurants & food", examples: "Restaurants, cafés and food businesses", href: "/login?next=/business/restaurants&as=partner", status: "Partner workspace available" },
  { title: "Drivers & transfers", examples: "Drivers, transfer operators and transport providers", href: "/driver/signup", status: "Driver application available" },
  { title: "Locals", examples: "Local companions and personalized local experiences", href: "/login?next=/locals/onboarding&as=local", status: "Separate Local onboarding" },
  { title: "Hotels & stays", examples: "Hotels, resorts, villas, apartments and camps", href: "/contact", status: "Supplier connection required" },
  { title: "Tours & experiences", examples: "Tour operators, guides, activities and experience providers", href: "/submit", status: "Experience submission available" },
  { title: "Sports & instructors", examples: "Kitesurfing, diving, water sports, trainers and instructors", href: "/login?next=/business/services&as=partner", status: "Service onboarding available" },
  { title: "Other travel partners", examples: "A travel service that does not fit the categories above", href: "/contact", status: "Talk to SafariPlug" },
];

export default function PartnersPage() {
  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="bg-[#111] text-white"><div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24"><p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#c9a86a]">SafariPlug Partners</p><h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">What do you provide?</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">Choose the part of SafariPlug you want to supply. We route you into the existing onboarding and compliance system for that business type instead of creating duplicate accounts.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/login?as=partner&next=/partners" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">Partner login</Link><Link href="/contact" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold">Talk to SafariPlug</Link></div></div></section>

    <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10"><div className="grid gap-4 md:grid-cols-2">{partnerTypes.map((type)=><Link key={type.title} href={type.href} className="group rounded-[1.6rem] border border-black/8 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-black/[.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-black/45">{type.status}</span><h2 className="mt-5 text-xl font-semibold">{type.title}</h2><p className="mt-2 text-sm leading-6 text-black/50">{type.examples}</p></div><span className="text-xl text-black/25 transition group-hover:translate-x-1">↗</span></div></Link>)}</div>

      <section className="mt-10 rounded-[1.75rem] border border-black/8 bg-white p-7"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/35">Trust before marketplace access</p><h2 className="mt-2 text-2xl font-semibold">Signing up does not make a partner verified.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-black/55">Public availability depends on the rules for each marketplace. SafariPlug may require a personal photo, business information, service details, rates, availability, identity or business verification, licenses, vehicle documents or other compliance evidence before activation. Existing driver, Local and provider verification gates remain authoritative.</p><Link href="/business/verification" className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Verification center →</Link></section>
    </section>
  </main>;
}
