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
        src: "/brand/safariplug-full-lockup.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
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
    ],
  };
}
