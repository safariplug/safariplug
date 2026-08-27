"use client";

import Link from "next/link";
import { useState } from "react";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    venue_name: string | null;
    price: number | null;
    currency: string | null;
    image_url: string | null;
    start_at: string;
    is_featured: boolean | null;
  };
}

export default function EventCard({ event }: EventCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageSource = event.image_url?.trim();

  return (
    <Link
      href={`/events/${event.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-zinc-900/50 transition-all duration-300 ${
        event.is_featured
          ? "border-amber-500/80 shadow-lg shadow-amber-500/10"
          : "border-zinc-800 hover:border-amber-500/50"
      }`}
    >
      <div className="relative h-52 w-full overflow-hidden bg-zinc-800">
        {imageSource && !imgError ? (
          <img
            src={imageSource}
            alt={event.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black p-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
              {event.category || "SafariPlug"}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div className="rounded-full border border-zinc-700/50 bg-black/60 px-3 py-1 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              {event.category || "SafariPlug"}
            </span>
          </div>
          {event.is_featured && (
            <div className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">
              Sponsored
            </div>
          )}
        </div>

        <div className="absolute right-3 top-3 rounded-full border border-zinc-700/50 bg-black/60 px-3 py-1 backdrop-blur-md">
          <span className="text-xs font-semibold text-white">
            {event.price && event.price > 0
              ? `${event.currency || "KES"} ${event.price}`
              : "Free"}
          </span>
        </div>
      </div>

      <div className="flex flex-grow flex-col p-5">
        <h2 className="line-clamp-1 text-xl font-bold transition-colors group-hover:text-amber-300">
          {event.title}
        </h2>
        <p className="mt-2 line-clamp-2 flex-grow text-sm text-gray-400">
          {event.description}
        </p>

        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
          <div className="flex items-center justify-between">
            <span className="max-w-[65%] truncate">
              📍 {event.venue_name || "To be verified"}
            </span>
            <span className="font-medium text-amber-400/90">
              📅 {new Date(event.start_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
