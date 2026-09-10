import Link from "next/link";

const offerings = [
  { title: "Service businesses", text: "Barbers, salons, massage, spas, tattoo artists, nails, lashes, fitness, yoga and wellness providers.", href: "/partner/signup", label: "List a service business" },
  { title: "Restaurants & hotels", text: "Put your restaurant, hotel or hospitality business in front of travelers and local customers.", href: "/partner/signup", label: "List your business" },
  { title: "Tours & experiences", text: "Guides, tour operators and experience providers can showcase bookable experiences across Africa.", href: "/partner/signup", label: "List an experience" },
  { title: "Drivers & transfers", text: "Join the SafariPlug driver network for airport transfers, hotel transfers, city rides and longer-distance travel.", href: "/become-a-driver", label: "Become a driver" },
  { title: "Events", text: "Concerts, festivals, nightlife and other one-time experiences can be submitted for discovery.", href: "/partner/events/create", label: "Submit an event" },
];

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link><Link href="/partner/login" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Partner sign in</Link></div></header>
      <section className="bg-slate-950 px-6 py-20 text-white"><div className="mx-auto max-w-6xl"><p className="text-sm font-black uppercase tracking-[0.2em] text-orange-400">SafariPlug for businesses</p><h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight sm:text-6xl">Put your business, service or experience in front of Africa.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">SafariPlug is not just for events. List the business customers and travelers are looking for — from a barber or massage therapist to a restaurant, hotel, tour operator, tattoo artist, wellness provider, driver or event organizer.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/partner/signup" className="rounded-2xl bg-orange-500 px-6 py-4 font-black text-white hover:bg-orange-600">Create a business account</Link><Link href="/partner/login" className="rounded-2xl border border-white/20 px-6 py-4 font-black text-white hover:bg-white/10">Already a partner? Sign in</Link></div></div></section>
      <section className="mx-auto max-w-6xl px-6 py-14"><div className="grid gap-5 md:grid-cols-2">{offerings.map((item) => <article key={item.title} className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">{item.title}</h2><p className="mt-3 leading-7 text-slate-500">{item.text}</p><Link href={item.href} className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{item.label} →</Link></article>)}</div>
        <div className="mt-10 rounded-[2rem] bg-white p-8 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">How it works</p><div className="mt-6 grid gap-6 md:grid-cols-3"><div><p className="text-lg font-black">1. Create your account</p><p className="mt-2 text-sm leading-6 text-slate-500">Tell us who you are and what kind of business or service you operate.</p></div><div><p className="text-lg font-black">2. Build your listing</p><p className="mt-2 text-sm leading-6 text-slate-500">Add services, prices, specialists, availability, photos and booking details.</p></div><div><p className="text-lg font-black">3. Get discovered & booked</p><p className="mt-2 text-sm leading-6 text-slate-500">SafariPlug customers can discover your business, check availability and book.</p></div></div></div>
      </section>
      <footer className="border-t bg-white px-6 py-10"><div className="mx-auto max-w-7xl"><p className="font-black">Safari<span className="text-orange-500">Plug</span></p><p className="mt-2 text-sm text-slate-500">Discover more. Experience more.</p></div></footer>
    </main>
  );
}
