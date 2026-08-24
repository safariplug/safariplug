import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";


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


  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("status", "published");



  const eventUrls =
    (events || []).map((event)=>({

      url: `${BASE_URL}/events/${event.id}`,

      lastModified: new Date(),

    }));




  const cityUrls =
    cities.map((city)=>({

      url:`${BASE_URL}/city/${city}`,

      lastModified:new Date(),

    }));




  const experienceUrls =
    experiences.map((experience)=>({

      url:`${BASE_URL}/experiences/${experience}`,

      lastModified:new Date(),

    }));




  return [

    {
      url: BASE_URL,
      lastModified:new Date(),
    },


    {
      url:`${BASE_URL}/events`,
      lastModified:new Date(),
    },


    ...cityUrls,

    ...experienceUrls,

    ...eventUrls,

  ];

}