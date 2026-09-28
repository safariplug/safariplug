import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ViatorCheckoutPage({ searchParams }: { searchParams: Promise<{ productCode?: string }> }) {
  const { productCode } = await searchParams;
  const bookingEnabled = String(process.env.VIATOR_BOOKING_ENABLED || "").toLowerCase() === "true";

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-5 py-12 text-[#111]">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-black/8 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#9d793e]">SafariPlug × Viator</p>
        <h1 className="mt-3 text-4xl font-semibold">Secure Viator checkout</h1>
        <p className="mt-4 text-sm leading-6 text-black/55">
          This HTTPS page is reserved for the Viator Secure Payment iFrame. It will be activated only after SafariPlug receives Full + Booking Access and the certified payment configuration.
        </p>
        <div className="mt-6 rounded-2xl bg-black/[.035] p-5 text-sm">
          <p><strong>Product:</strong> {productCode || "Not selected"}</p>
          <p className="mt-2"><strong>Currency:</strong> USD</p>
          <p className="mt-2"><strong>Status:</strong> {bookingEnabled ? "Booking integration enabled" : "Waiting for Viator Booking Access"}</p>
        </div>
        {!bookingEnabled ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            SafariPlug will not render a fake payment form or submit a booking hold until Viator enables the transactional endpoints and provides the certified iFrame requirements.
          </div>
        ) : null}
        <Link href="/activities/viator" className="mt-7 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">← Back to Viator experiences</Link>
      </section>
    </main>
  );
}
