import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createManualSupplierInvite } from "./actions";

export default async function ManualSupplierInvitePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-7">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-amber-400">SafariPlug // Partner Operations</p>
            <h1 className="mt-2 text-4xl font-bold">Invite a supplier manually</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Use this when SafariPlug already knows the supplier and you do not need AI discovery first. This follows the same linked enrollment model used for Samuel Juma: CRM prospect → partner relationship → invitation → onboarding → Partner 360.
            </p>
          </div>
          <Link href="/admin/suppliers" className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white">Back to suppliers</Link>
        </div>

        <section className="mt-7 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-amber-200">Nothing is sent automatically</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Creating this record makes an approved, human-entered CRM prospect and a draft invitation. You will still review the invitation, approve it, and explicitly send it from the governed outreach workspace.
          </p>
        </section>

        <form action={createManualSupplierInvite} className="mt-7 space-y-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Business / supplier name" name="business_name" required placeholder="e.g. Sam Juma" />
            <Field label="Supplier category" name="category" required placeholder="e.g. Tattoo & Body Art, Hotel, Transfer Vendor" />
            <Field label="City / location" name="city" placeholder="e.g. Nairobi" />
            <Field label="Website" name="website" type="url" placeholder="https://..." />
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-zinc-500">Primary contact</p>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field label="Contact name" name="contact_name" required placeholder="Full name" />
              <Field label="Email" name="contact_email" type="email" placeholder="supplier@example.com" />
              <Field label="Phone / WhatsApp" name="phone" placeholder="+254..." />
            </div>
            <p className="mt-3 text-xs text-zinc-500">At least one of email or phone is required. Email can be sent automatically only after human approval and only when SafariPlug email delivery is configured. WhatsApp remains disabled until a real provider is connected.</p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Staff notes</span>
            <textarea name="notes" rows={4} maxLength={2000} placeholder="What do we already know about this supplier?" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-amber-400" />
          </label>

          <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm leading-6 text-zinc-400">
            After creation, SafariPlug opens the governed invitation workspace. The supplier will not be active, verified, published, or bookable until they accept the invitation, complete onboarding, and pass staff review.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link href="/admin/suppliers" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300">Cancel</Link>
            <button type="submit" className="rounded-full bg-amber-400 px-6 py-3 text-sm font-black text-black">Create supplier invitation draft →</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name, type = "text", required = false, placeholder = "" }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}{required ? " *" : ""}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white outline-none focus:border-amber-400" />
    </label>
  );
}
