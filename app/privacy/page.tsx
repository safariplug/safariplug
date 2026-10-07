import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy", description: "SafariPlug privacy policy." };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <article className="mx-auto max-w-4xl px-6 py-20 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-400">Legal · Updated 7 October 2026</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">Privacy Policy</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-white/65">
          <section><h2 className="text-xl font-semibold text-white">1. What we collect</h2><p className="mt-2">Depending on how you use SafariPlug, we may collect account and contact details, trip and booking information, payment-status references, supplier information, support messages, device/browser information, approximate location you choose to provide, and activity needed to operate and secure the service.</p></section>
          <section><h2 className="text-xl font-semibold text-white">2. Why we use it</h2><p className="mt-2">We use information to provide discovery, booking and trip-management features; process or reconcile permitted transactions; communicate about bookings and accounts; prevent abuse; improve the service; meet legal obligations; and support suppliers and travelers.</p></section>
          <section><h2 className="text-xl font-semibold text-white">3. Connected suppliers and processors</h2><p className="mt-2">A booking may involve SafariPlug suppliers or connected travel, payment, messaging, hosting, analytics or identity-verification providers. We share only the information reasonably needed for the relevant service. A connected supplier may also process information under its own privacy terms.</p></section>
          <section><h2 className="text-xl font-semibold text-white">4. Payments</h2><p className="mt-2">SafariPlug does not intentionally store full payment-card details when a payment provider or supplier-hosted secure payment flow is used. Payment providers may receive information necessary to authorize and reconcile a transaction.</p></section>
          <section><h2 className="text-xl font-semibold text-white">5. Retention and security</h2><p className="mt-2">We keep information only as long as reasonably required for the service, legal obligations, fraud prevention, dispute handling and legitimate business records. We use technical and organizational safeguards, but no online service can guarantee absolute security.</p></section>
          <section><h2 className="text-xl font-semibold text-white">6. Your choices</h2><p className="mt-2">You may request access, correction or deletion of personal information where applicable. Some records may need to be retained for legal, security, accounting or booking-dispute reasons.</p></section>
          <section><h2 className="text-xl font-semibold text-white">7. Contact</h2><p className="mt-2">Privacy questions and requests can be sent to <a className="text-amber-300" href="mailto:info@safariplug.com">info@safariplug.com</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
