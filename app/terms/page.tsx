import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Use", description: "SafariPlug terms of use." };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <article className="mx-auto max-w-4xl px-6 py-20 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-400">Legal · Updated 7 October 2026</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">Terms of Use</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-white/65">
          <section><h2 className="text-xl font-semibold text-white">1. SafariPlug's role</h2><p className="mt-2">SafariPlug helps travelers discover, plan and book travel-related products and local services. Depending on the product, SafariPlug may provide the booking interface, facilitate a supplier booking, or send you to a clearly identified connected supplier or external checkout.</p></section>
          <section><h2 className="text-xl font-semibold text-white">2. Availability and pricing</h2><p className="mt-2">Prices, availability and booking status are not guaranteed until the relevant booking flow confirms them. Where SafariPlug cannot verify live availability, we will not represent it as confirmed. Supplier-specific restrictions, cancellation rules and eligibility requirements may apply.</p></section>
          <section><h2 className="text-xl font-semibold text-white">3. Payments</h2><p className="mt-2">Payment method and currency depend on the product and supplier. SafariPlug-owned inventory and connected supplier inventory may use different payment flows. The checkout screen or supplier flow presented before purchase controls the payment currency and applicable transaction terms.</p></section>
          <section><h2 className="text-xl font-semibold text-white">4. Cancellations, changes and refunds</h2><p className="mt-2">Cancellation and refund rights depend on the specific booking and supplier policy. Do not assume every product is refundable. Where SafariPlug manages the booking directly, the applicable cancellation terms are shown in the booking flow or confirmation. For connected suppliers, their stated terms may apply.</p></section>
          <section><h2 className="text-xl font-semibold text-white">5. Events and external information</h2><p className="mt-2">Some event and discovery information may come from public or partner sources. SafariPlug is not the organizer unless the listing explicitly identifies SafariPlug as such. Always confirm time-sensitive event details with the identified source before travel or payment.</p></section>
          <section><h2 className="text-xl font-semibold text-white">6. Acceptable use</h2><p className="mt-2">You may not misuse SafariPlug, attempt unauthorized access, interfere with other users or suppliers, submit fraudulent information, scrape protected account data, or use the service in violation of applicable law.</p></section>
          <section><h2 className="text-xl font-semibold text-white">7. Supplier responsibility</h2><p className="mt-2">Independent suppliers are responsible for the products and services they deliver, subject to SafariPlug's verification, marketplace and dispute processes where applicable. Verification status does not eliminate all travel or service risk.</p></section>
          <section><h2 className="text-xl font-semibold text-white">8. Contact</h2><p className="mt-2">Questions about these terms can be sent to <a className="text-amber-300" href="mailto:info@safariplug.com">info@safariplug.com</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
