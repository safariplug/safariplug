import Link from "next/link";

export const metadata = {
  title: "Offline",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-6 py-16 text-white">
      <section className="w-full max-w-md text-center">
        <img
          src="/brand/safariplug-wordmark-light.png"
          alt="SafariPlug"
          className="mx-auto h-8 w-auto"
        />
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a86a]/10 text-2xl text-[#e7c98d]">
            ↻
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            You&apos;re offline
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            SafariPlug needs a connection to load fresh events, availability,
            pricing and booking information. Reconnect and try again.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#c9a86a] px-6 text-sm font-bold text-black transition hover:bg-[#e7c98d]"
          >
            Try SafariPlug again
          </Link>
        </div>
      </section>
    </main>
  );
}
