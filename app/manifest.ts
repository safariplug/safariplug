import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafariPlug",
    short_name: "SafariPlug",
    description:
      "Discover events, experiences, trusted locals and services across Africa.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    categories: ["travel", "lifestyle", "entertainment"],
    icons: [
      {
        src: "/pwa-icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Discover Events",
        short_name: "Events",
        description: "Explore upcoming SafariPlug events.",
        url: "/events",
      },
      {
        name: "Explore Experiences",
        short_name: "Experiences",
        description: "Browse SafariPlug experiences.",
        url: "/experiences",
      },
      {
        name: "My Trips",
        short_name: "Trips",
        description: "Open your SafariPlug trips.",
        url: "/account/trips",
      },
      {
        name: "Staff Portal",
        short_name: "Staff",
        description: "Open the secure SafariPlug admin and staff portal.",
        url: "/staff/login",
      },
    ],
  };
}
