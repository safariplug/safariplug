"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const intents = [
  { words: ["driver", "ride", "transfer", "pickup", "pick up", "airport", "taxi", "car"], path: "/drivers" },
  { words: ["local friend", "local companion", "meet a local", "local guide", "show me around", "showaround", "hang out", "hangout"], path: "/locals" },
  { words: ["hotel", "stay", "room", "accommodation", "resort", "lodge"], path: "/hotels" },
  { words: ["barber", "massage", "masseur", "nail", "manicure", "pedicure", "tattoo", "salon", "spa", "beauty", "instructor", "trainer", "diving", "kite surf", "kitesurf"], path: "/services" },
  { words: ["restaurant", "food", "dinner", "lunch", "breakfast", "eat", "dining"], path: "/restaurants" },
  { words: ["event", "concert", "festival", "party", "nightlife", "tonight", "weekend", "live music", "comedy"], path: "/events" },
  { words: ["experience", "tour", "safari", "things to do", "activity", "activities", "adventure", "beach"], path: "/experiences" },
];

function destinationFor(query: string) {
  const normalized = query.toLowerCase();
  const intent = intents.find((item) => item.words.some((word) => normalized.includes(word)));
  return intent?.path || `/concierge?q=${encodeURIComponent(query)}`;
}

export default function SmartFind() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(destinationFor(value));
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-4xl" role="search" aria-label="Find anything on SafariPlug">
      <div className="rounded-[1.7rem] border border-white/20 bg-black/45 p-2 shadow-2xl backdrop-blur-xl sm:flex sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4">
          <span aria-hidden="true" className="text-xl text-[#e7c98d]">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Local companion, massage in Diani, airport driver, things to do tonight…" className="min-h-14 w-full bg-transparent text-base text-white outline-none placeholder:text-white/40" autoComplete="off" />
        </div>
        <button type="submit" disabled={!query.trim()} className="mt-2 w-full rounded-full bg-[#e7c98d] px-6 py-4 text-sm font-black text-[#070708] transition hover:bg-[#f0d9a4] disabled:cursor-not-allowed disabled:opacity-45 sm:mt-0 sm:w-auto">Find it →</button>
      </div>
      <p className="mt-3 px-2 text-xs leading-5 text-white/45">Search naturally. SafariPlug recognizes common needs and takes you straight to the right area; broader requests open Concierge with your request attached.</p>
    </form>
  );
}
