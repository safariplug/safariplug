import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BASE_URL = "https://www.safariplug.com";
const cities = ["nairobi", "mombasa", "diani", "kilifi", "zanzibar"];
const experiences = ["nightlife", "beaches", "safari", "food", "date-night", "live-music", "hidden-gems"];

type EventSitemapRow = { id: string; updated_at?: string | null; start_at?: string | null };
type JournalSitemapRow = { slug: string; updated_at?: string | null; published_at?: string | null };
type BusinessSitemapRow = { id: string; slug?: string | null; updated_at?: string | null; business_type?: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const [{ data: events }, { data: articles }, { data: businesses }] = await Promise.all([
    supabase.from("events").select("id,updated_at,start_at").eq("status", "approved"),
    supabaseAdmin.from("journal_articles").select("slug,updated_at,published_at").eq("status", "published"),
    supabaseAdmin.from("businesses").select("id,slug,updated_at,business_type").in("status", ["active","ACTIVE"]).limit(5000),
  ]);

  const eventUrls = ((events ?? []) as EventSitemapRow[]).map((event) => ({ url: `${BASE_URL}/events/${event.id}`, lastModified: new Date(event.updated_at || event.start_at || now) }));
  const cityUrls = cities.map((city) => ({ url: `${BASE_URL}/city/${city}`, lastModified: new Date() }));
  const experienceUrls = experiences.map((experience) => ({ url: `${BASE_URL}/experiences/${experience}`, lastModified: new Date() }));
  const journalUrls = ((articles ?? []) as JournalSitemapRow[]).map((article) => ({ url: `${BASE_URL}/journal/${article.slug}`, lastModified: new Date(article.updated_at || article.published_at || now) }));
  const serviceUrls = ((businesses ?? []) as BusinessSitemapRow[])
    .filter((business) => business.slug && business.business_type !== "Restaurant")
    .map((business) => ({ url: `${BASE_URL}/services/${business.slug}`, lastModified: new Date(business.updated_at || now) }));
  const restaurantUrls = ((businesses ?? []) as BusinessSitemapRow[])
    .filter((business) => business.business_type === "Restaurant")
    .map((business) => ({ url: `${BASE_URL}/restaurants/${business.id}`, lastModified: new Date(business.updated_at || now) }));

  const coreRoutes = [
    "", "/experiences", "/activities", "/hotels", "/transfers", "/drivers", "/services", "/restaurants", "/events",
    "/about", "/contact", "/partners", "/privacy", "/terms", "/journal",
  ].map((path) => ({ url: `${BASE_URL}${path}`, lastModified: new Date() }));

  return [...coreRoutes, ...cityUrls, ...experienceUrls, ...serviceUrls, ...restaurantUrls, ...eventUrls, ...journalUrls];
}
