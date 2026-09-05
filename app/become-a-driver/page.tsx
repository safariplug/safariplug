import Link from "next/link";

export default function BecomeADriverPage() {
  return (
    <main className="min-h-screen bg-[#070708] px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8 md:p-12">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#c9a86a]">SafariPlug Driver Network</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Turn your driving service into trusted travel infrastructure.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">Join the SafariPlug driver network for airport, hotel and private transfers. We review every application and require mandatory live identity/liveness verification before drivers can become bookable.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/driver/signup" className="rounded-full bg-[#c9a86a] px-7 py-3.5 text-center font-black text-black">Apply to become a driver →</Link>
          <Link href="/driver/login" className="rounded-full border border-zinc-700 px-7 py-3.5 text-center font-bold text-white">Existing driver sign in</Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 p-5"><p className="font-bold">Apply</p><p className="mt-2 text-sm leading-6 text-zinc-500">Create an account and submit your service, vehicle and availability details.</p></div>
          <div className="rounded-2xl border border-zinc-800 p-5"><p className="font-bold">Verify</p><p className="mt-2 text-sm leading-6 text-zinc-500">Complete the required identity, license and live face/liveness checks.</p></div>
          <div className="rounded-2xl border border-zinc-800 p-5"><p className="font-bold">Drive</p><p className="mt-2 text-sm leading-6 text-zinc-500">Once approved and active, become eligible for matching transfer assignments.</p></div>
        </div>
        <p className="mt-8 text-xs leading-5 text-zinc-600">Submitting an application never creates a bookable driver. SafariPlug does not accept identity documents through this public form.</p>
      </section>
    </main>
  );
}
