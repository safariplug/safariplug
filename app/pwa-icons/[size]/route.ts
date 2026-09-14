import React from "react";
import { ImageResponse } from "next/og";

const SUPPORTED_SIZES = new Set([192, 512]);

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!SUPPORTED_SIZES.has(size)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const logoUrl = new URL(
    "/brand/safariplug-full-lockup.png",
    request.url,
  ).toString();

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          padding: "20%",
          boxSizing: "border-box",
        },
      },
      React.createElement("img", {
        src: logoUrl,
        alt: "SafariPlug",
        style: {
          width: "100%",
          height: "auto",
          objectFit: "contain",
        },
      }),
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
