import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BASE_URL = "https://safariplug.com";

const cities = [
  "nairobi",
  "mombasa",
  "diani",
  "kilifi",
  "zanzibar",
];

const experiences = [
  "nightlife",
  "beaches",
  "safari",
  "food",
  "date-night",
  "live-music",
  "hidden-gems",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: events }, { data: articles }] = await Promise.all([
    supabase.from("events").select("id").eq("status", "approved"),
    supabaseAdmin.from("journal_articles").select("slug, updated_at, published_at").eq("status", "published"),
  ]);

  const eventUrls = (events || []).map((event) => ({
    url: `${BASE_URL}/events/${event.id}`,
    lastModified: new Date(),
  }));

  const cityUrls = cities.map((city) => ({
    url: `${BASE_URL}/city/${city}`,
    lastModified: new Date(),
  }));

  const experienceUrls = experiences.map((experience) => ({
    url: `${BASE_URL}/experiences/${experience}`,
    lastModified: new Date(),
  }));

  const journalUrls = (articles || []).map((article) => ({
    url: `${BASE_URL}/journal/${article.slug}`,
    lastModified: new Date(article.updated_at || article.published_at || Date.now()),
  }));

  return [
    { url: BASE_URL, lastModified: new Date() },
    { url: `${BASE_URL}/events`, lastModified: new Date() },
    { url: `${BASE_URL}/journal`, lastModified: new Date() },
    ...cityUrls,
    ...experienceUrls,
    ...eventUrls,
    ...journalUrls,
  ];
}
