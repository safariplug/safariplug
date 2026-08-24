import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  venue_name: string | null;
  venue_address: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  organizer_name: string | null;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30";

function formatDate(date:string){
  return new Intl.DateTimeFormat("en-KE",{
    timeZone:"Africa/Nairobi",
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric"
  }).format(new Date(date));
}

function formatPrice(
  price:number|null,
  currency:string|null
){
  if(price === null) return "Free";

  return new Intl.NumberFormat("en-KE",{
    style:"currency",
    currency:currency || "KES",
    maximumFractionDigits:0
  }).format(price);
}


export async function generateMetadata({
 params
}:{
 params:Promise<{id:string}>
}):Promise<Metadata>{

 const {id}=await params;

 const {data}=await supabase
 .from("events")
 .select("title,description,image_url")
 .eq("id",id)
 .single();


 if(!data){
  return {
   title:"SafariPlug Experience"
  };
 }


 return {
  title:`${data.title} | SafariPlug`,
  description:
   data.description ||
   "Discover East Africa experiences.",
  openGraph:{
   images:[
    data.image_url || FALLBACK_IMAGE
   ]
  }
 };

}



export default async function EventPage({
 params
}:{
 params:Promise<{id:string}>
}){


 const {id}=await params;


 const {data,error}=await supabase
 .from("events")
 .select(`
 id,
 title,
 description,
 category,
 start_at,
 venue_name,
 venue_address,
 price,
 currency,
 image_url,
 booking_url,
 organizer_name
 `)
 .eq("id",id)
 .single();



 if(error || !data){
  notFound();
 }


 const event=data as Event;



 return (

 <main className="min-h-screen bg-[#fffaf5] text-slate-950">


 <header className="border-b bg-white">

 <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

 <Link
 href="/"
 className="text-3xl font-black"
 >
 Safari<span className="text-orange-500">Plug</span>
 </Link>


 <Link
 href="/events"
 className="font-bold text-slate-600"
 >
 ← Events
 </Link>

 </div>

 </header>



 <section className="relative h-[520px]">

 <img
 src={event.image_url || FALLBACK_IMAGE}
 alt={event.title}
 className="h-full w-full object-cover"
 />

 <div className="absolute inset-0 bg-black/50"/>


 <div className="absolute inset-0 flex items-end">

 <div className="mx-auto max-w-7xl w-full px-6 pb-14 text-white">


 <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold">
 {event.category}
 </span>


 <h1 className="mt-6 text-5xl font-black md:text-7xl">
 {event.title}
 </h1>


 <p className="mt-5 text-lg">
 📅 {formatDate(event.start_at)}
 </p>


 </div>

 </div>

 </section>



 <section className="mx-auto max-w-7xl px-6 py-14">


 <div className="grid gap-10 lg:grid-cols-[1fr_380px]">


 <div className="space-y-8">


 <article className="rounded-3xl bg-white p-8 shadow">

 <h2 className="text-3xl font-black">
 About this experience
 </h2>


 <p className="mt-5 text-lg leading-8 text-slate-600">
 {event.description ||
 "More details coming soon."}
 </p>

 </article>



 <article className="rounded-3xl bg-white p-8 shadow">

 <h2 className="text-3xl font-black">
 Location
 </h2>


 <p className="mt-4 text-slate-600">
 📍 {event.venue_name}
 </p>


 <p className="text-slate-500">
 {event.venue_address}
 </p>

 </article>



 <article className="rounded-3xl bg-white p-8 shadow">

 <h2 className="text-3xl font-black">
 Organizer
 </h2>


 <p className="mt-4 font-bold">
 {event.organizer_name ||
 "SafariPlug Partner"}
 </p>

 </article>


 </div>



 <aside>

 <div className="sticky top-10 rounded-3xl bg-white p-8 shadow-xl">


 <p className="text-sm font-bold uppercase text-orange-500">
 Tickets
 </p>


 <h3 className="mt-3 text-4xl font-black">
 {formatPrice(
 event.price,
 event.currency
 )}
 </h3>


 {event.booking_url &&

 <a
 href={event.booking_url}
 target="_blank"
 className="mt-8 block rounded-full bg-orange-500 px-6 py-4 text-center font-bold text-white"
 >
 Get Tickets →
 </a>

 }


 </div>

 </aside>


 </div>


 </section>



 </main>

 );

}