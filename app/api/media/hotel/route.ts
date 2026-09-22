import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "imagecontent.net",
  "www.imagecontent.net",
  "static.locktrip.com",
  "locktrip.com",
  "www.locktrip.com",
  "safariplug.com",
  "www.safariplug.com",
]);

function normalizedSource(raw: string) {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS hotel images are allowed.");
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error("Hotel image host is not allowed.");

  if ((parsed.hostname === "safariplug.com" || parsed.hostname === "www.safariplug.com") && parsed.pathname.startsWith("/gmx/")) {
    return new URL("https://static.locktrip.com" + parsed.pathname + parsed.search);
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ message: "url is required." }, { status: 400 });

  let source: URL;
  try {
    source = normalizedSource(raw);
  } catch {
    return NextResponse.json({ message: "Invalid hotel image URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      cache: "force-cache",
      headers: {
        "user-agent": "SafariPlug/1.0 (+https://safariplug.com)",
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json({ message: "Hotel image unavailable." }, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ message: "Upstream did not return an image." }, { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch {
    return NextResponse.json({ message: "Hotel image unavailable." }, { status: 502 });
  }
}
