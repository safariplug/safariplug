import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/account/", "/auth/", "/partner/"],
      },
    ],
    sitemap: "https://www.safariplug.com/sitemap.xml",
  };
}
