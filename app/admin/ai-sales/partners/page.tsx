"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function handleWhatsAppOutreach(phone: string, draft: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");

  if (!cleanPhone) return false;

  window.open(
    `https://wa.me/${cleanPhone}?text=${encodeURIComponent(draft)}`,
    "_blank"
  );
  return true;
}

type Partner = {
  id: string;
  venue_or_promoter_name: string;
  contact_person: string | null;
  email_or_phone: string | null;
  instagram_handle: string | null;
  outreach_stage: string;
  notes: string | null;
};

export default function PartnerCRMPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [outreachDraft, setOutreachDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newInstagram, setNewInstagram] = useState("");

  useEffect(() => {
    void fetchPartners();
  }, []);

  async function fetchPartners() {
    setLoading(true);
    const { data, error } = await supabase
      .from("safari_partners")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching partners:", error.message);
    } else {
      setPartners((data || []) as Partner[]);
    }
    setLoading(false);
  }

  async function handleAddPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;

    const { error } = await supabase.from("safari_partners").insert({
      venue_or_promoter_name: newName.trim(),
      contact_person: newContact.trim() || null,
      email_or_phone: newEmail.trim() || null,
      instagram_handle: newInstagram.trim() || null,
      outreach_stage: "prospect",
    });

    if (error) {
      setStatusMsg(`Error adding partner: ${error.message}`);
      return;
    }

    setNewName("");
    setNewContact("");
    setNewEmail("");
    setNewInstagram("");
    setShowNewModal(false);
    await fetchPartners();
  }

  function handleGeneratePitch(partner: Partner) {
    setSelectedPartner(partner);
    const name = partner.contact_person || "Partner";
    const venue = partner.venue_or_promoter_name;
    setOutreachDraft(`Subject: Featuring ${venue} on SafariPlug\n\nHi ${name},\n\nI’ve been following ${venue} and love the energy you're bringing to the local scene.\n\nI’m reaching out from SafariPlug—our curated discovery engine highlighting the best experiences across East Africa. We would love to spotlight your upcoming events directly to our growing audience of experience seekers.\n\nWould you be open to collaborating or sharing your event calendar so we can feature your listings?\n\nBest regards,\nErick Mwirigi\nSafariPlug Curation Team`);
    setStatusMsg(null);
  }

  async function handleSendEmail() {
    if (!selectedPartner?.email_or_phone) {
      setStatusMsg("Partner email is missing.");
      return;
    }

    setSending(true);
    setStatusMsg(null);
    try {
      const response = await fetch("/api/admin/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedPartner.email_or_phone,
          subject: "Collaboration Opportunity with SafariPlug",
          message: outreachDraft,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send outreach email.");
      }
      setStatusMsg("Outreach email dispatched successfully!");
      await supabase.from("safari_partners").update({ outreach_stage: "contacted" }).eq("id", selectedPartner.id);
      await fetchPartners();
    } catch (error) {
      setStatusMsg(`Error: ${error instanceof Error ? error.message : "Unexpected error"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-black p-8 font-sans text-white selection:bg-amber-500 selection:text-black md:p-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 border-b border-zinc-800 pb-6 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">SafariPlug CRM // Partner Operations</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Venue &amp; Promoter Pipeline</h1>
            <p className="mt-1 text-sm text-zinc-400">Track relationships and dispatch AI-crafted outreach campaigns.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNewModal(true)} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-amber-400">+ Add Venue Partner</button>
            <Link href="/admin/marketing" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium transition-colors hover:border-amber-500">&larr; Marketing Studio</Link>
          </div>
        </div>

        <div className="mb-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
          <div className="border-b border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="font-mono text-sm uppercase tracking-wider text-zinc-300">Active Pipeline ({partners.length})</h2>
          </div>
          {loading ? (
            <div className="animate-pulse py-20 text-center font-mono text-xs text-zinc-500">Loading partner database...</div>
          ) : partners.length === 0 ? (
            <div className="py-20 text-center font-mono text-xs text-zinc-500">No partner records found. Click <span className="text-amber-400">&quot;+ Add Venue Partner&quot;</span> to begin tracking.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono text-xs">
                <thead><tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-500"><th className="p-4">Venue / Promoter</th><th className="p-4">Contact</th><th className="p-4">Email / Phone</th><th className="p-4">Instagram</th><th className="p-4">Stage</th><th className="p-4 text-right">Actions</th></tr></thead>
                <tbody>{partners.map((partner) => <tr key={partner.id} className="border-b border-zinc-900 transition-colors hover:bg-zinc-900/20"><td className="p-4 font-bold text-white">{partner.venue_or_promoter_name}</td><td className="p-4 text-zinc-300">{partner.contact_person || "N/A"}</td><td className="p-4 text-zinc-400">{partner.email_or_phone || "N/A"}</td><td className="p-4 text-zinc-400">{partner.instagram_handle ? `@${partner.instagram_handle}` : "N/A"}</td><td className="p-4"><span className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] uppercase text-amber-400">{partner.outreach_stage}</span></td><td className="p-4 text-right"><button onClick={() => handleGeneratePitch(partner)} className="rounded-lg bg-amber-500 px-3.5 py-1.5 font-bold text-black transition-colors hover:bg-amber-400">Draft AI Pitch</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>

        {showNewModal && <Modal title="Add Venue or Promoter" onClose={() => setShowNewModal(false)}><form onSubmit={handleAddPartner} className="space-y-4 font-mono text-xs">{[["Venue / Promoter Name *", newName, setNewName, true], ["Contact Person", newContact, setNewContact, false], ["Email or Phone", newEmail, setNewEmail, false], ["Instagram Handle", newInstagram, setNewInstagram, false]].map(([label, value, setter, required]) => <label key={label as string} className="block text-zinc-400">{label as string}<input required={required as boolean} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-white outline-none focus:border-amber-500" /></label>)}<div className="flex justify-end gap-3 border-t border-zinc-800 pt-4"><button type="button" onClick={() => setShowNewModal(false)} className="rounded-xl bg-zinc-900 px-4 py-2 text-zinc-300">Cancel</button><button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-black">Save Partner</button></div></form></Modal>}

        {selectedPartner && <Modal title={`Pitch: ${selectedPartner.venue_or_promoter_name}`} onClose={() => setSelectedPartner(null)}><div className="space-y-4"><label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">Recipient Email:<input value={selectedPartner.email_or_phone || ""} readOnly className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-xs text-zinc-300" /></label><label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">AI-Crafted Message Draft:<textarea rows={8} value={outreachDraft} onChange={(event) => setOutreachDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-relaxed text-zinc-300 outline-none focus:border-amber-500" /></label>{statusMsg && <p className="rounded-xl border border-amber-900/50 bg-amber-950/40 p-3 font-mono text-xs text-amber-400">{statusMsg}</p>}</div><div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-zinc-800 pt-4"><button onClick={() => { if (!handleWhatsAppOutreach(selectedPartner.email_or_phone || "", outreachDraft)) setStatusMsg("A phone number is required for WhatsApp outreach."); }} disabled={!selectedPartner.email_or_phone} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 font-mono text-xs font-bold text-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-500">Open WhatsApp</button><button onClick={handleSendEmail} disabled={sending || !selectedPartner.email_or_phone} className="rounded-xl bg-amber-500 px-5 py-2.5 font-mono text-xs font-bold text-black disabled:bg-zinc-800 disabled:text-zinc-500">{sending ? "Dispatching..." : "Send Email via Amani"}</button></div></Modal>}
      </div>
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl md:p-8"><div className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4"><h3 className="text-xl font-bold">{title}</h3><button onClick={onClose} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:text-white">Close</button></div>{children}</div></div>;
}