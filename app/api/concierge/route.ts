import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SYSTEM = `You are SafariPlug Concierge, an elite booking concierge for SafariPlug's local services marketplace.
Your job is to understand a client's natural-language request, search real SafariPlug service businesses, check LIVE appointment availability, recommend a few strong options, and book only when the client has explicitly authorized the booking.

Rules:
- Never invent businesses, services, prices, staff, availability, or booking status. Use tools for all live facts.
- Ask for the minimum missing information needed. You generally need service, location/city, and a date/time or time window before checking availability.
- Respect provider service offerings, prices, durations, qualified staff, booking notice, and booking window.
- If the user says “book”, “reserve”, “yes, book it”, or otherwise clearly authorizes a specific option, you may call book_appointment with confirmed=true. Do not book merely because the user is browsing.
- Before booking, restate the exact provider, service, specialist (or any available), date/time, price and duration when possible. If the user has already clearly selected and authorized it in the current turn, do not create unnecessary friction.
- If a booking requires provider confirmation, describe it as requested/pending, not confirmed.
- Prefer 2–4 recommendations when multiple good choices exist.
- Be concise, polished, warm, and confident. This is a premium concierge, not a generic chatbot.
- Current date is ${new Date().toISOString().slice(0,10)}.`;

const tools = [
  {
    type: "function" as const,
    name: "search_services",
    description: "Search active SafariPlug service businesses and offerings using real marketplace data. Use for salons, barbers, spas, wellness, fitness and other appointment services.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Service or business keywords, e.g. barber, manicure, massage" },
        city: { type: "string", description: "City or locality if known" },
        maxPrice: { type: ["number", "null"], description: "Maximum price in the marketplace currency if specified" }
      },
      required: ["query", "city", "maxPrice"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "check_availability",
    description: "Check real open appointment slots for one SafariPlug service offering on a specific local date. Never claim a slot is available without this tool.",
    parameters: {
      type: "object",
      properties: {
        serviceProfileId: { type: "string" },
        offeringId: { type: "string" },
        date: { type: "string", description: "Local date YYYY-MM-DD" },
        staffId: { type: ["string", "null"], description: "Preferred staff id, or null for any qualified specialist" }
      },
      required: ["serviceProfileId", "offeringId", "date", "staffId"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "book_appointment",
    description: "Create a real SafariPlug appointment. Only use after the client has explicitly authorized booking a specific option. The slot is rechecked atomically by the booking backend.",
    parameters: {
      type: "object",
      properties: {
        serviceProfileId: { type: "string" },
        offeringId: { type: "string" },
        staffId: { type: "string" },
        startsAt: { type: "string", description: "Exact ISO timestamp returned by availability" },
        customerName: { type: "string" },
        customerEmail: { type: ["string", "null"] },
        customerPhone: { type: ["string", "null"] },
        customerNotes: { type: ["string", "null"] },
        confirmed: { type: "boolean", description: "Must be true only when the client explicitly authorized this booking" }
      },
      required: ["serviceProfileId", "offeringId", "staffId", "startsAt", "customerName", "customerEmail", "customerPhone", "customerNotes", "confirmed"],
      additionalProperties: false
    },
    strict: true
  }
];

async function runTool(name: string, args: Record<string, unknown>) {
  if (name === "search_services") {
    const query = String(args.query || "").trim();
    const city = String(args.city || "").trim();
    const maxPrice = typeof args.maxPrice === "number" ? args.maxPrice : null;
    let q = supabaseAdmin
      .from("service_profiles")
      .select("id,timezone,booking_status,businesses!inner(id,name,slug,city_id,address,latitude,longitude,phone,whatsapp,website_url,logo_url,cover_image_url,verified,claimed,status),service_categories(name),service_offerings!inner(id,name,description,duration_minutes,price,currency,status)")
      .eq("status", "active")
      .eq("booking_status", "open")
      .eq("service_offerings.status", "active")
      .limit(80);
    const { data, error } = await q;
    if (error) throw error;
    const needle = query.toLowerCase();
    const cityNeedle = city.toLowerCase();
    const rows = (data ?? []).flatMap((p: any) => {
      const b = p.businesses;
      const category = p.service_categories?.name ?? "Service";
      const offerings = Array.isArray(p.service_offerings) ? p.service_offerings : [p.service_offerings];
      return offerings.map((o: any) => ({ profileId: p.id, offeringId: o.id, provider: b?.name, slug: b?.slug, address: b?.address, cityId: b?.city_id, category, verified: !!b?.verified, claimed: !!b?.claimed, timezone: p.timezone, service: o.name, description: o.description, durationMinutes: o.duration_minutes, price: Number(o.price), currency: o.currency }))
        .filter((x: any) => (!needle || `${x.provider} ${x.category} ${x.service} ${x.description ?? ""}`.toLowerCase().includes(needle)) && (!cityNeedle || `${x.address ?? ""} ${x.cityId ?? ""}`.toLowerCase().includes(cityNeedle)) && (maxPrice === null || x.price <= maxPrice));
    });
    return rows.slice(0, 20);
  }
  if (name === "check_availability") {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com";
    const params = new URLSearchParams({ serviceProfileId: String(args.serviceProfileId), offeringId: String(args.offeringId), date: String(args.date) });
    const response = await fetch(`${base}/api/services/availability?${params.toString()}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return { error: body.error || "Unable to check availability" };
    const staffId = args.staffId ? String(args.staffId) : null;
    const slots = staffId ? (body.slots ?? []).filter((s: any) => s.staffId === staffId) : body.slots ?? [];
    return { timeZone: body.timeZone, date: body.date, durationMinutes: body.durationMinutes, slots: slots.slice(0, 24) };
  }
  if (name === "book_appointment") {
    if (args.confirmed !== true) return { error: "Booking requires explicit client confirmation." };
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com"}/api/services/appointments`, { method: "POST", headers: { "content-type": "application/json", "x-safariplug-concierge": "1" }, body: JSON.stringify({ serviceProfileId: args.serviceProfileId, offeringId: args.offeringId, staffId: args.staffId, customerName: args.customerName, customerEmail: args.customerEmail, customerPhone: args.customerPhone, startsAt: args.startsAt, customerNotes: args.customerNotes }) });
    const body = await response.json();
    if (!response.ok) return { error: body.error || "The selected slot could not be booked.", status: response.status };
    return { appointment: body.appointment };
  }
  return { error: "Unknown tool" };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const messages = Array.isArray(payload?.messages) ? payload.messages.slice(-12) : [];
    if (!messages.length) return NextResponse.json({ error: "messages are required" }, { status: 400 });
    const sanitized = messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 3000) }));
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    const customerContext = user ? `\nAuthenticated customer email: ${user.email || "unknown"}. Do not reveal account internals.` : "";
    let input: any[] = [{ role: "system", content: SYSTEM + customerContext }, ...sanitized];
    let finalText = "";
    for (let turn = 0; turn < 4; turn++) {
      const response = await openai.responses.create({ model: "gpt-5.6-luna", input, tools, store: false });
      const calls = response.output.filter((item: any) => item.type === "function_call");
      if (!calls.length) { finalText = response.output_text; break; }
      input.push(...response.output as any);
      for (const call of calls) {
        const args = JSON.parse(call.arguments || "{}");
        const result = await runTool(call.name, args);
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
    }
    if (!finalText) finalText = "I’m sorry, I couldn’t complete that request. Please try again.";
    return NextResponse.json({ message: finalText });
  } catch (error) {
    console.error("concierge", error);
    return NextResponse.json({ error: "SafariPlug Concierge is temporarily unavailable." }, { status: 500 });
  }
}
