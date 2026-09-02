"use client";

import { useEffect } from "react";

export default function AIEventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AI EVENTS ROUTE ERROR:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-5 py-16 text-slate-950">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-2xl font-black text-white">S</div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">SafariPlug Intelligence</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">AI Events needs a refresh</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-500">
          The discovery inbox encountered an unexpected rendering error. Try the page again; the error has also been logged on the client for diagnosis.
        </p>
        {error?.digest && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-mono text-slate-500">
            Error reference: {error.digest}
          </p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-500"
          >
            Try again
          </button>
          <a
            href="/admin/ai-scout"
            className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 transition hover:border-orange-300"
          >
            Open AI Scout
          </a>
        </div>
      </div>
    </main>
  );
}
