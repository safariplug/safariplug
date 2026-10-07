import { supabaseAdmin } from "@/lib/supabase-admin";

export type BusyWindow = { start: string; end: string; title?: string | null };
export type TripLiveRecommendation =
  | { kind: "event"; id: string; title: string; subtitle: string; href: string; startAt: string; endAt: string | null; price: number | null; currency: string | null; budgetFit: boolean | null; scheduleFit: boolean }
  | { kind: "service"; id: string; title: string; subtitle: string; href: string; price: number; currency: string; budgetFit: boolean | null; scheduleFit: true };

function overlap(aStart:number,aEnd:number,bStart:number,bEnd:number){return aStart < bEnd && aEnd > bStart;}

export function eventFitsBusyWindows(event:{start_at:string;end_at:string|null},busy:BusyWindow[]){
  const start=Date.parse(event.start_at);
  const end=event.end_at?Date.parse(event.end_at):start+2*60*60*1000;
  if(!Number.isFinite(start)||!Number.isFinite(end))return false;
  return !busy.some(window=>{
    const ws=Date.parse(window.start),we=Date.parse(window.end);
    return Number.isFinite(ws)&&Number.isFinite(we)&&overlap(start,end,ws,we);
  });
}

export function budgetFit(price:number|null,currency:string|null,budget:{remaining:number;currency:string}|null){
  if(price==null||!currency||!budget)return null;
  if(currency.toUpperCase()!==budget.currency.toUpperCase())return null;
  return price<=budget.remaining;
}

export async function loadTripLiveRecommendations(input:{
  cityId:string|null;
  cityName:string|null;
  startOn:string|null;
  endOn:string|null;
  busy:BusyWindow[];
  budget:{remaining:number;currency:string}|null;
}) {
  const servicesPromise = input.cityId
    ? supabaseAdmin.from("service_profiles")
        .select("id,businesses!inner(id,name,slug,city_id,status),service_categories(name),service_offerings!inner(id,name,price,currency,status)")
        .eq("status","active")
        .eq("booking_status","open")
        .eq("businesses.city_id",input.cityId)
        .in("businesses.status",["active","ACTIVE"])
        .eq("service_offerings.status","active")
        .limit(100)
    : Promise.resolve({data:[] as any[],error:null});

  let eventQuery = supabaseAdmin.from("events")
    .select("id,title,category,venue_name,start_at,end_at,price,currency,city_id")
    .eq("status","approved")
    .order("start_at",{ascending:true})
    .limit(80);
  if(input.cityId) eventQuery=eventQuery.eq("city_id",input.cityId);
  if(input.startOn) eventQuery=eventQuery.gte("start_at",new Date(input.startOn+"T00:00:00Z").toISOString());
  else eventQuery=eventQuery.gte("start_at",new Date().toISOString());
  if(input.endOn) eventQuery=eventQuery.lte("start_at",new Date(input.endOn+"T23:59:59Z").toISOString());

  const [{data:profiles,error:serviceError},{data:events,error:eventError}] = await Promise.all([servicesPromise,eventQuery]);
  if(serviceError) throw serviceError;
  if(eventError) throw eventError;

  const services:TripLiveRecommendation[]=(profiles||[]).flatMap((profile:any)=>{
    const business=profile.businesses;
    const offerings=Array.isArray(profile.service_offerings)?profile.service_offerings:[profile.service_offerings];
    return offerings.filter(Boolean).map((offering:any)=>({
      kind:"service" as const,
      id:String(offering.id),
      title:String(offering.name||"Service"),
      subtitle:[String(business?.name||"SafariPlug provider"),String(profile.service_categories?.name||"Service")].filter(Boolean).join(" · "),
      href:`/services/${encodeURIComponent(String(business?.slug||""))}`,
      price:Number(offering.price||0),
      currency:String(offering.currency||"KES"),
      budgetFit:budgetFit(Number(offering.price||0),String(offering.currency||"KES"),input.budget),
      scheduleFit:true as const,
    }));
  }).filter(item=>item.price>0)
    .sort((a,b)=>(a.budgetFit===false?1:0)-(b.budgetFit===false?1:0)||a.price-b.price)
    .slice(0,6);

  const eventRecommendations:TripLiveRecommendation[]=(events||[])
    .filter((event:any)=>eventFitsBusyWindows(event,input.busy))
    .map((event:any)=>({
      kind:"event" as const,
      id:String(event.id),
      title:String(event.title||"Event"),
      subtitle:[event.category,event.venue_name].filter(Boolean).join(" · "),
      href:`/events/${event.id}`,
      startAt:String(event.start_at),
      endAt:event.end_at?String(event.end_at):null,
      price:event.price==null?null:Number(event.price),
      currency:event.currency?String(event.currency):null,
      budgetFit:budgetFit(event.price==null?null:Number(event.price),event.currency?String(event.currency):null,input.budget),
      scheduleFit:true,
    }))
    .sort((a,b)=>(a.budgetFit===false?1:0)-(b.budgetFit===false?1:0)||Date.parse(a.startAt)-Date.parse(b.startAt))
    .slice(0,6);

  return { cityName:input.cityName, services, events:eventRecommendations };
}
