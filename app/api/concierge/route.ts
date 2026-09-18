import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ServiceResult = {
  profileId: string; offeringId: string; provider: string; slug: string; address: string | null; cityId: string | null; cityName: string | null; category: string; verified: boolean; claimed: boolean; timezone: string; service: string; description: string | null; durationMinutes: number; price: number; currency: string;
};
type Slot = { staffId: string; staffName: string; startsAt: string; endsAt: string; label: string };
type ConciergeCard = ServiceResult & { slots: Slot[]; availabilityChecked: boolean };
const SYSTEM = `You are SafariPlug Concierge, an elite travel and lifestyle concierge for SafariPlug.\nYour job is to understand a client's natural-language request and coordinate the real SafariPlug marketplace across stays, activities, transfers, verified Locals, events and personal services. For appointment services, search real providers, check LIVE appointment availability, recommend strong options, and book only when the client has explicitly authorized the booking.\n\nRules:\n- Never invent businesses, hotels, activities, transfers, Locals, events, services, prices, staff, availability, or booking status. Use tools for all live facts.\n- For stays, activities and transfers, direct the client to SafariPlug's governed live search rather than pretending you searched supplier inventory.\n- For verified Local companions, events and experiences, direct the client to the relevant SafariPlug discovery surface when live results are not available through your tools.\n- Maintain a persistent request context across the entire conversation. Extract and RETAIN every detail the client has already supplied: service type, city/neighborhood, date, relative date, time, time window, budget, service preference, and other constraints.\n- A follow-up message normally changes or fills ONE missing detail; it does NOT reset the request.\n- If the client changes a detail, replace only that detail and preserve all other known details.\n- Resolve relative dates such as “today”, “tomorrow”, “this Saturday”, and “this weekend” using the current date supplied below. Resolve natural time windows such as “morning”, “afternoon”, “evening”, and “after 5 PM” into the appropriate availability search window.\n- Ask for the minimum missing information needed. You generally need service, location/city, and a date/time or time window before checking availability. If those are already present in earlier messages, search immediately.\n- Respect provider service offerings, prices, durations, qualified staff, booking notice, and booking window.\n- If the user says “book”, “reserve”, “yes, book it”, or otherwise clearly authorizes booking a specific option, you may call book_appointment with confirmed=true.\n- If a booking requires provider confirmation, describe it as requested/pending, not confirmed.\n- Prefer 2–4 recommendations when multiple good choices exist.\n- Be concise, polished, warm, and confident. This is a premium concierge, not a generic chatbot.\n- Current date is ${new Date().toISOString().slice(0,10)}.`;
const tools = [
  { type: "function" as const, name: "search_services", description: "Search active SafariPlug service businesses and offerings using real marketplace data. Use for salons, barbers, spas, wellness, fitness and other appointment services.", parameters: { type: "object", properties: { query: { type: "string", description: "Service or business keywords" }, city: { type: "string", description: "City or locality if known" }, maxPrice: { type: ["number", "null"], description: "Maximum price if specified" } }, required: ["query", "city", "maxPrice"], additionalProperties: false }, strict: true },
  { type: "function" as const, name: "check_availability", description: "Check real open appointment slots for one SafariPlug service offering on a specific local date. Never claim a slot is available without this tool.", parameters: { type: "object", properties: { serviceProfileId: { type: "string" }, offeringId: { type: "string" }, date: { type: "string", description: "Local date YYYY-MM-DD" }, staffId: { type: ["string", "null"], description: "Preferred staff id, or null" } }, required: ["serviceProfileId", "offeringId", "date", "staffId"], additionalProperties: false }, strict: true },
  { type: "function" as const, name: "book_appointment", description: "Create a real SafariPlug appointment. Only use after the client has explicitly authorized booking a specific option. The slot is rechecked by the booking backend.", parameters: { type: "object", properties: { serviceProfileId: { type: "string" }, offeringId: { type: "string" }, staffId: { type: "string" }, startsAt: { type: "string" }, customerName: { type: "string" }, customerEmail: { type: ["string", "null"] }, customerPhone: { type: ["string", "null"] }, customerNotes: { type: ["string", "null"] }, confirmed: { type: "boolean" } }, required: ["serviceProfileId", "offeringId", "staffId", "startsAt", "customerName", "customerEmail", "customerPhone", "customerNotes", "confirmed"], additionalProperties: false }, strict: true },
  { type: "function" as const, name: "search_locals", description: "Search active verified SafariPlug Local companions using public-eligibility rules.", parameters: { type: "object", properties: { city: { type: "string" }, interest: { type: "string" } }, required: ["city","interest"], additionalProperties: false }, strict: true },
  { type: "function" as const, name: "search_events", description: "Search approved upcoming SafariPlug events using real catalog data.", parameters: { type: "object", properties: { city: { type: "string" }, query: { type: "string" }, limit: { type: "number" } }, required: ["city","query","limit"], additionalProperties: false }, strict: true }\n];
async function runTool(name: string, args: Record<string, unknown>) {
  if (name === "search_services") {
    const query = String(args.query || "").trim().toLowerCase(); const city = String(args.city || "").trim(); const maxPrice = typeof args.maxPrice === "number" ? args.maxPrice : null; let cityIds: string[] | null = null; const cityNames = new Map<string, string>();
    if (city) { const { data: cities } = await supabaseAdmin.from("cities").select("id,name").ilike("name", `%${city}%`).limit(10); cityIds = (cities ?? []).map((c: any) => c.id); for (const c of cities ?? []) cityNames.set(c.id, c.name); if (!cityIds.length) return []; }
    const { data, error } = await supabaseAdmin.from("service_profiles").select("id,timezone,booking_status,businesses!inner(id,name,slug,city_id,address,latitude,longitude,phone,whatsapp,website_url,logo_url,cover_image_url,verified,claimed,status),service_categories(name),service_offerings!inner(id,name,description,duration_minutes,price,currency,status)").eq("status", "active").eq("booking_status", "open").eq("businesses.status", "active").eq("service_offerings.status", "active").limit(100);
    if (error) throw error;
    const rows: ServiceResult[] = (data ?? []).flatMap((p: any) => { const b = p.businesses; const category = p.service_categories?.name ?? "Service"; const offerings = Array.isArray(p.service_offerings) ? p.service_offerings : [p.service_offerings]; return offerings.map((o: any) => ({ profileId: p.id, offeringId: o.id, provider: b?.name ?? "SafariPlug provider", slug: b?.slug ?? "", address: b?.address ?? null, cityId: b?.city_id ?? null, cityName: cityNames.get(b?.city_id) ?? null, category, verified: !!b?.verified, claimed: !!b?.claimed, timezone: p.timezone || "Africa/Nairobi", service: o.name, description: o.description ?? null, durationMinutes: Number(o.duration_minutes), price: Number(o.price), currency: o.currency })).filter((x: ServiceResult) => (!cityIds || cityIds.includes(x.cityId || "")) && (!query || `${x.provider} ${x.category} ${x.service} ${x.description ?? ""}`.toLowerCase().includes(query)) && (maxPrice === null || x.price <= maxPrice)); });
    return rows.slice(0, 20);
  }
  if (name === "check_availability") { const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com"; const params = new URLSearchParams({ serviceProfileId: String(args.serviceProfileId), offeringId: String(args.offeringId), date: String(args.date) }); const response = await fetch(`${base}/api/services/availability?${params.toString()}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) return { error: body.error || "Unable to check availability" }; const staffId = args.staffId ? String(args.staffId) : null; const slots = staffId ? (body.slots ?? []).filter((s: any) => s.staffId === staffId) : body.slots ?? []; return { timeZone: body.timeZone, date: body.date, durationMinutes: body.durationMinutes, slots: slots.slice(0, 24) }; }
  if (name === "search_locals") { const city=String(args.city||"").trim(); const interest=String(args.interest||"").trim().toLowerCase(); let q=supabaseAdmin.from("local_profiles").select("id,display_name,bio,personal_photo_url,city,country,languages,interests,specialties,hourly_rate,currency").eq("service_status","active").eq("verification_state","verified").not("identity_liveness_verified_at","is",null).limit(12); if(city) q=q.ilike("city",`%${city}%`); const {data,error}=await q; if(error) throw error; return (data??[]).filter((x:any)=>!interest||`${x.bio||""} ${(x.interests||[]).join(" ")} ${(x.specialties||[]).join(" ")}`.toLowerCase().includes(interest)).slice(0,6).map((x:any)=>({...x,href:`/locals/${x.id}`})); }
  if (name === "search_events") { const city=String(args.city||"").trim().toLowerCase(); const query=String(args.query||"").trim().toLowerCase(); const limit=Math.min(Math.max(Number(args.limit)||6,1),10); const {data,error}=await supabaseAdmin.from("events").select("id,title,description,category,venue_name,start_at,price,currency,image_url,cities(name,country)").eq("status","approved").gte("start_at",new Date().toISOString()).order("start_at",{ascending:true}).limit(40); if(error) throw error; return (data??[]).map((e:any)=>{const rel=Array.isArray(e.cities)?e.cities[0]:e.cities;return {...e,city:rel?.name||null,country:rel?.country||null,href:`/events/${e.id}`};}).filter((e:any)=>{const hay=`${e.title} ${e.description||""} ${e.category||""} ${e.venue_name||""} ${e.city||""}`.toLowerCase(); return (!city||String(e.city||"").toLowerCase().includes(city))&&(!query||hay.includes(query));}).slice(0,limit); }\n  if (name === "book_appointment") { if (args.confirmed !== true) return { error: "Booking requires explicit client confirmation." }; const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com"}/api/services/appointments`, { method: "POST", headers: { "content-type": "application/json", "x-safariplug-concierge": "1" }, body: JSON.stringify({ serviceProfileId: args.serviceProfileId, offeringId: args.offeringId, staffId: args.staffId, customerName: args.customerName, customerEmail: args.customerEmail, customerPhone: args.customerPhone, startsAt: args.startsAt, customerNotes: args.customerNotes }) }); const body = await response.json(); if (!response.ok) return { error: body.error || "The selected slot could not be booked.", status: response.status }; return { appointment: body.appointment }; }
  return { error: "Unknown tool" };
}

function marketplaceActions(messages: Array<{ role?: string; content?: string }>) {
  const latest = [...messages].reverse().find((m) => m?.role !== "assistant")?.content?.toLowerCase() || "";
  const actions: Array<{ href: string; title: string; detail: string }> = [];
  const add = (href: string, title: string, detail: string) => { if (!actions.some((x) => x.href === href)) actions.push({ href, title, detail }); };
  if (/hotel|stay|room|accommodation|resort|lodge/.test(latest)) add("/hotels", "Search live stays", "Run SafariPlug's governed hotel search and compare real bookable options.");
  if (/activity|activities|tour|ticket|excursion|safari|diving|kite|adventure/.test(latest)) add("/activities", "Search live activities", "Open SafariPlug's live activities inventory and book through the governed checkout.");
  if (/transfer|airport|pickup|drop.?off|transport|ride/.test(latest)) add("/transfers", "Search live transfers", "Search live transfer routes and vehicle options.");
  if (/driver|chauffeur/.test(latest)) add("/drivers", "Find a driver", "Browse SafariPlug drivers and request the right person for your trip.");
  if (/local|guide|companion|host/.test(latest)) add("/locals", "Meet verified Locals", "Browse active Locals who have passed identity and live-face/liveness verification.");
  if (/event|concert|nightlife|festival|party|comedy|music/.test(latest)) add("/events", "Browse upcoming events", "Explore SafariPlug's approved live event catalog.");
  if (/barber|massage|masseur|nail|manicure|pedicure|tattoo|salon|spa|wellness|service/.test(latest)) add("/services", "Book a personal service", "Search real SafariPlug service providers and live appointment times.");
  return actions.slice(0, 4);
}

function journeyGaps(input: {
  startOn: string | null;
  endOn: string | null;
  destination: string | null;
  arrangedKinds: string[];
  itemCount: number;
  openLocalRequests: number;
  openTransferRequests: number;
}) {
  const kinds = new Set(input.arrangedKinds.map((x) => x.toLowerCase()));
  const gaps: Array<{ kind: string; title: string; detail: string; href: string; priority: "core" | "enhancement" }> = [];
  const add = (kind: string, title: string, detail: string, href: string, priority: "core" | "enhancement") => {
    if (!gaps.some((gap) => gap.kind === kind)) gaps.push({ kind, title, detail, href, priority });
  };

  const hasHotel = ["hotel","stay","accommodation"].some((x) => kinds.has(x));
  const hasTransfer = ["transfer","driver_transfer","transport"].some((x) => kinds.has(x)) || input.openTransferRequests > 0;
  const hasActivity = ["activity","experience","event"].some((x) => kinds.has(x));
  const hasLocal = ["local","local_request"].some((x) => kinds.has(x)) || input.openLocalRequests > 0;
  const hasService = ["service","appointment"].some((x) => kinds.has(x));

  if (input.startOn && input.endOn && !hasHotel) add("hotel", "No stay attached yet", "Your journey has dates but no recorded stay. Search live accommodation when you are ready.", "/hotels", "core");
  if (input.destination && !hasTransfer) add("transfer", "Transport is still open", "No transfer or driver request is recorded for this journey yet.", "/transfers", "core");
  if (!hasActivity) add("activity", "Add something to do", "No activity or experience is recorded yet. Browse live activities or SafariPlug experiences.", "/activities", input.itemCount ? "enhancement" : "core");
  if (!hasLocal) add("local", "Meet a verified Local", "There is no active Local request yet. A verified Local can help with food, culture, nightlife or hidden gems.", "/locals", "enhancement");
  if (!hasService) add("service", "Personal services are open", "No personal service appointment is attached yet. You can add a barber, massage, nails, tattoo or wellness service.", "/services", "enhancement");

  return gaps.slice(0, 5);
}

function itineraryTimingIssues(items: Array<{ id?: string; item_kind?: string | null; title?: string | null; start_at?: string | null; end_at?: string | null }>) {
  const lodgingKinds = new Set(["hotel","stay","accommodation"]);
  const scheduled = items
    .filter((item) => item.start_at && item.end_at && !lodgingKinds.has(String(item.item_kind || "").toLowerCase()))
    .map((item) => ({ ...item, startMs: Date.parse(String(item.start_at)), endMs: Date.parse(String(item.end_at)) }))
    .filter((item) => Number.isFinite(item.startMs) && Number.isFinite(item.endMs) && item.endMs > item.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const issues: Array<{ type: "overlap" | "tight"; severity: "high" | "medium"; title: string; detail: string; firstItem: string; secondItem: string; gapMinutes: number | null }> = [];
  for (let i = 0; i < scheduled.length - 1; i++) {
    const current = scheduled[i];
    const next = scheduled[i + 1];
    const firstItem = current.title || current.item_kind || "Scheduled item";
    const secondItem = next.title || next.item_kind || "Scheduled item";
    if (next.startMs < current.endMs) {
      const overlapMinutes = Math.ceil((current.endMs - next.startMs) / 60000);
      issues.push({
        type: "overlap",
        severity: "high",
        title: "Schedule overlap detected",
        detail: `${firstItem} overlaps ${secondItem} by about ${overlapMinutes} minute${overlapMinutes === 1 ? "" : "s"}.`,
        firstItem,
        secondItem,
        gapMinutes: -overlapMinutes,
      });
      continue;
    }
    const gapMinutes = Math.floor((next.startMs - current.endMs) / 60000);
    if (gapMinutes < 60) {
      issues.push({
        type: "tight",
        severity: "medium",
        title: "Tight turnaround",
        detail: `${firstItem} ends only ${gapMinutes} minute${gapMinutes === 1 ? "" : "s"} before ${secondItem} starts. Allow time for travel, delays and check-in.`,
        firstItem,
        secondItem,
        gapMinutes,
      });
    }
  }
  return { scheduledCount: scheduled.length, issues: issues.slice(0, 5) };
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(); const realIp = request.headers.get("x-real-ip")?.trim(); const ip = (forwarded || realIp || "unknown").slice(0, 120); const { data: allowed, error: rateError } = await supabaseAdmin.rpc("consume_concierge_rate_limit", { p_bucket: `concierge:${ip}`, p_limit: 20, p_window_seconds: 60 }); if (rateError) return NextResponse.json({ error: "Concierge is temporarily unavailable." }, { status: 503 }); if (allowed !== true) return NextResponse.json({ error: "Concierge is busy. Please wait a moment and try again." }, { status: 429 });
    const client = await createSupabaseServerClient(); const { data: { user } } = await client.auth.getUser(); const registeredClient = !!user && !user.is_anonymous && !!(user.email_confirmed_at || user.phone_confirmed_at); if (!registeredClient) return NextResponse.json({ error: "registered_client_required", message: "SafariPlug Concierge is available to registered clients. Please sign in or create your free SafariPlug account to continue.", signInUrl: "/login?next=/concierge", signUpUrl: "/login?next=/concierge&mode=signup" }, { status: 401 });
    const payload = await request.json(); const messages = Array.isArray(payload?.messages) ? payload.messages.slice(-12) : []; if (!messages.length) return NextResponse.json({ error: "messages are required" }, { status: 400 });
    const tripId = typeof payload?.tripId === "string" && payload.tripId.trim() ? payload.tripId.trim() : null;
    let tripContext = "";
    let tripSummary: { id: string; title: string | null; destination: string | null; startOn: string | null; endOn: string | null; itemCount: number; arrangedKinds: string[]; openLocalRequests: number; openTransferRequests: number; gaps: Array<{ kind: string; title: string; detail: string; href: string; priority: "core" | "enhancement" }>; timing: { scheduledCount: number; issues: Array<{ type: "overlap" | "tight"; severity: "high" | "medium"; title: string; detail: string; firstItem: string; secondItem: string; gapMinutes: number | null }> } } | null = null;
    if (tripId) {
      const { data: trip, error: tripError } = await supabaseAdmin.from("trips").select("id,title,destination_city_id,start_on,end_on,status,cities(name,country)").eq("id", tripId).eq("traveler_id", user!.id).maybeSingle();
      if (tripError) throw tripError;
      if (!trip) return NextResponse.json({ error: "journey_not_found" }, { status: 404 });
      const city = Array.isArray(trip.cities) ? trip.cities[0] : trip.cities;
      const [itemsResult, localResult, transferResult] = await Promise.all([
        supabaseAdmin.from("trip_items").select("id,item_kind,title,start_at,end_at").eq("trip_id", tripId).order("position", { ascending: true }).limit(50),
        supabaseAdmin.from("local_requests").select("id,status,activity,requested_start,requested_end").eq("trip_id", tripId).eq("traveler_id", user!.id).limit(50),
        supabaseAdmin.from("driver_transfer_requests").select("id,status,pickup_label,destination_label,requested_at").eq("trip_id", tripId).eq("traveler_id", user!.id).limit(50),
      ]);
      if (itemsResult.error || localResult.error || transferResult.error) throw itemsResult.error || localResult.error || transferResult.error;
      const itinerary = itemsResult.data ?? [];
      const locals = localResult.data ?? [];
      const transfers = transferResult.data ?? [];
      const arrangedKinds = [...new Set(itinerary.map((item: any) => String(item.item_kind || "plan")).filter(Boolean))];
      const itinerarySummary = itinerary.slice(0, 12).map((item: any) => [item.item_kind || "plan", item.title || "Untitled item", item.start_at || "date not set"].join(" · ")).join("; ");
      const localSummary = locals.slice(0, 8).map((item: any) => [item.activity || "Local request", item.status || "requested", item.requested_start || "date not set"].join(" · ")).join("; ");
      const transferSummary = transfers.slice(0, 8).map((item: any) => [`${item.pickup_label || "Pickup"} → ${item.destination_label || "Destination"}`, item.status || "requested", item.requested_at || "date not set"].join(" · ")).join("; ");
      const openLocalRequests = locals.filter((item: any) => !["declined","cancelled","completed"].includes(String(item.status || ""))).length;
      const openTransferRequests = transfers.filter((item: any) => !["declined","cancelled","completed"].includes(String(item.status || ""))).length;
      const timing = itineraryTimingIssues(itinerary);
      const gaps = journeyGaps({
        startOn: trip.start_on || null,
        endOn: trip.end_on || null,
        destination: city?.name || null,
        arrangedKinds,
        itemCount: itinerary.length,
        openLocalRequests,
        openTransferRequests,
      });
      tripSummary = {
        id: trip.id,
        title: trip.title || null,
        destination: city?.name || null,
        startOn: trip.start_on || null,
        endOn: trip.end_on || null,
        itemCount: itinerary.length,
        arrangedKinds,
        openLocalRequests,
        openTransferRequests,
        gaps,
        timing,
      };
      tripContext = `\nThe client is planning within their SafariPlug journey “${trip.title}”. Journey dates: ${trip.start_on || "not set"} to ${trip.end_on || "not set"}. Destination: ${city?.name || "not set"}. Existing itinerary items: ${itinerarySummary || "none"}. Existing Local requests: ${localSummary || "none"}. Existing transfer requests: ${transferSummary || "none"}. Detected journey gaps: ${gaps.map((gap) => gap.title).join("; ") || "none"}. Schedule issues: ${timing.issues.map((issue) => issue.detail).join("; ") || "none"}. Use this existing journey state to avoid suggesting duplicate arrangements unless the client asks for alternatives. Prefer filling genuine gaps in the journey, but present them as optional next steps rather than requirements. Flag recorded schedule overlaps and tight turnarounds clearly, but do not reschedule, cancel, or modify any itinerary item automatically. Do not imply that an item is confirmed merely because it exists in the itinerary; respect its recorded status. If a service is booked through this conversation, it is associated with the authenticated client; do not claim it has been added to the journey unless the booking system explicitly returns that relationship.`;
    }
    const sanitized = messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 3000) })); const customerContext = `\nAuthenticated registered customer email: ${user!.email || "unknown"}. Account id: ${user!.id}. Do not reveal account internals.`; let input: any[] = [{ role: "system", content: SYSTEM + customerContext + tripContext }, ...sanitized]; let finalText = ""; const serviceResults = new Map<string, ServiceResult>(); const availabilityResults = new Map<string, Slot[]>(); const discoveryResults: any[] = []; let lastBooking: any = null;
    for (let turn = 0; turn < 4; turn++) {
      const response = await openai.responses.create({ model: "gpt-5.6-luna", input, tools, store: false });
      const calls = (response.output as any[]).filter((item: any) => item.type === "function_call");
      if (!calls.length) { finalText = response.output_text; break; }
      input.push(...(response.output as any[]));
      for (const call of calls) { let args: Record<string, unknown>; try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; } const result = await runTool(call.name, args); if (call.name === "search_services" && Array.isArray(result)) for (const row of result as ServiceResult[]) serviceResults.set(`${row.profileId}:${row.offeringId}`, row); if ((call.name === "search_locals" || call.name === "search_events") && Array.isArray(result)) discoveryResults.push(...result.map((row:any)=>({ ...row, kind: call.name === "search_locals" ? "local" : "event" }))); if (call.name === "check_availability" && result && typeof result === "object" && !Array.isArray(result) && "slots" in result) { const r = result as { slots?: Slot[] }; availabilityResults.set(`${String(args.serviceProfileId)}:${String(args.offeringId)}`, r.slots ?? []); } if (call.name === "book_appointment" && result && typeof result === "object" && "appointment" in result) lastBooking = (result as any).appointment; input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) }); }
    }
    if (!finalText) finalText = "I’m sorry, I couldn’t complete that request. Please try again.";
    const cards: ConciergeCard[] = Array.from(serviceResults.values()).slice(0, 4).map(row => ({ ...row, slots: availabilityResults.get(`${row.profileId}:${row.offeringId}`) ?? [], availabilityChecked: availabilityResults.has(`${row.profileId}:${row.offeringId}`) }));
    return NextResponse.json({ message: finalText, cards, discoveries: discoveryResults.slice(0,8), actions: marketplaceActions(messages), booking: lastBooking, trip: tripSummary || (tripId ? { id: tripId } : null) });
  } catch (error) { console.error("concierge", error); return NextResponse.json({ error: "SafariPlug Concierge is temporarily unavailable." }, { status: 500 }); }
}
