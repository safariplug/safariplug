"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Stage = "prospect" | "contacted" | "pitch_sent" | "partnered";
type Tab = "events" | "partners" | "analytics";
type ViewMode = "kanban" | "table";
type Tone = "energetic" | "sophisticated" | "direct";

type Partner = {
  id: string;
  venue_or_promoter_name: string;
  contact_person: string | null;
  email_or_phone: string | null;
  instagram_handle: string | null;
  outreach_stage: Stage;
};

type TelemetryLog = {
  id: string;
  action_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const STAGES: { key: Stage; label: string }[] = [
  { key: "prospect", label: "Prospects" },
  { key: "contacted", label: "Contacted" },
  { key: "pitch_sent", label: "Pitch Sent" },
  { key: "partnered", label: "Partnered" },
];

export default function AdminDashboardPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [partnersViewMode, setPartnersViewMode] = useState<ViewMode>("kanban");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryLog[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [outreachDraft, setOutreachDraft] = useState("");
  const [tone, setTone] = useState<Tone>("energetic");
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newInstagram, setNewInstagram] = useState("");

  const fetchPartners = useCallback(async () => {
    setLoadingPartners(true);
    const { data, error } = await supabase.from("safari_partners").select("*").order("created_at", { ascending: false });
    if (error) showToast(`Error fetching partners: ${error.message}`, "error");
    else setPartners((data || []) as Partner[]);
    setLoadingPartners(false);
  }, [showToast]);

  const fetchTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    const { data, error } = await supabase.from("admin_telemetry_logs").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) showToast(`Error fetching telemetry: ${error.message}`, "error");
    else setTelemetry((data || []) as TelemetryLog[]);
    setLoadingTelemetry(false);
  }, [showToast]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "partners") void fetchPartners();
    if (tab === "analytics") void fetchTelemetry();
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPartner(null);
        setShowNewModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function logTelemetry(actionType: string, metadata: Record<string, unknown>) {
    await supabase.from("admin_telemetry_logs").insert([{ action_type: actionType, metadata }]);
  }

  async function handleAIScout() {
    setScouting(true);
    try {
      const response = await fetch("/api/admin/partners/discover", { method: "POST" });
      const result = (await response.json()) as { success?: boolean; count?: number; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Partner scouting failed.");
      }
      showToast(`Amani successfully scouted and added ${result.count || 0} new venue partners!`);
      void fetchPartners();
    } catch (error) {
      showToast(`Scouting failed: ${error instanceof Error ? error.message : "Unexpected error"}`, "error");
    } finally {
      setScouting(false);
    }
  }

  async function handleAddPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase.from("safari_partners").insert({ venue_or_promoter_name: newName.trim(), contact_person: newContact.trim() || null, email_or_phone: newEmail.trim() || null, instagram_handle: newInstagram.trim() || null, outreach_stage: "prospect" });
    if (error) {
      showToast(`Error: ${error.message}`, "error");
      return;
    }
    showToast(`Successfully added partner: ${newName}`);
    void logTelemetry("partner_added", { venue: newName });
    setNewName(""); setNewContact(""); setNewEmail(""); setNewInstagram(""); setShowNewModal(false); void fetchPartners();
  }

  function handleGeneratePitch(partner: Partner, selectedTone = tone) {
    setSelectedPartner(partner);
    const name = partner.contact_person || "Partner";
    const venue = partner.venue_or_promoter_name;
    const drafts: Record<Tone, string> = {
      energetic: `Subject: Spotlighting ${venue} on SafariPlug 🔥\n\nHi ${name},\n\nAbsolute fan of the energy ${venue} is bringing to the scene right now!\n\nI’m reaching out from SafariPlug—East Africa's premier experience discovery engine. We want to put your upcoming lineup directly in front of thousands of active experience seekers.\n\nLet’s collaborate and drive a massive crowd to your next event. Open to a quick sync?\n\nBest,\nErick Mwirigi\nSafariPlug`,
      sophisticated: `Subject: Strategic Partnership Inquiry // ${venue} & SafariPlug\n\nDear ${name},\n\nWe have been closely following the curation and exceptional guest experiences at ${venue}.\n\nSafariPlug specializes in high-value audience alignment across East Africa. We would be delighted to feature your distinguished events within our curated directory.\n\nWe welcome the opportunity to discuss a formal media collaboration.\n\nWarm regards,\nErick Mwirigi\nSafariPlug Partnerships`,
      direct: `Subject: Featuring ${venue} listings on SafariPlug\n\nHi ${name},\n\nQuick note from SafariPlug: we highlight top regional venues and events to active local audiences.\n\nCan we list your calendar on our platform to drive direct traffic to ${venue}?\n\nBest,\nErick Mwirigi\nSafariPlug`,
    };
    setOutreachDraft(drafts[selectedTone]);
  }

  function updateTone(nextTone: Tone) {
    setTone(nextTone);
    if (selectedPartner) handleGeneratePitch(selectedPartner, nextTone);
  }

  async function updatePartnerStage(partnerId: string, newStage: Stage) {
    setPartners((previous) => previous.map((partner) => partner.id === partnerId ? { ...partner, outreach_stage: newStage } : partner));
    const { error } = await supabase.from("safari_partners").update({ outreach_stage: newStage }).eq("id", partnerId);
    if (error) {
      showToast(`Failed to update stage: ${error.message}`, "error");
      void fetchPartners();
    } else {
      showToast(`Stage updated to ${newStage.replace("_", " ")}`);
      void logTelemetry("stage_updated", { partner_id: partnerId, new_stage: newStage });
    }
  }

  async function handleSendEmail() {
    if (!selectedPartner?.email_or_phone) { showToast("Partner email is missing.", "error"); return; }
    setSending(true);
    try {
      const response = await fetch("/api/admin/send-outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: selectedPartner.email_or_phone, subject: "Collaboration Opportunity with SafariPlug", message: outreachDraft }) });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to send outreach email.");
      showToast("Outreach email dispatched successfully!");
      await updatePartnerStage(selectedPartner.id, "pitch_sent");
      void logTelemetry("email_sent", { partner_id: selectedPartner.id, venue: selectedPartner.venue_or_promoter_name });
      setSelectedPartner(null);
    } catch (error) { showToast(`Error: ${error instanceof Error ? error.message : "Unexpected error"}`, "error"); }
    finally { setSending(false); }
  }

  function handleWhatsAppOutreach() {
    if (!selectedPartner?.email_or_phone) { showToast("Partner phone number / contact is missing.", "error"); return; }
    const cleanPhone = selectedPartner.email_or_phone.replace(/[^0-9]/g, "");
    if (!cleanPhone) { showToast("A valid phone number is required for WhatsApp outreach.", "error"); return; }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(outreachDraft)}`, "_blank");
    showToast("WhatsApp deep link opened!");
    void updatePartnerStage(selectedPartner.id, "pitch_sent");
    void logTelemetry("whatsapp_opened", { partner_id: selectedPartner.id, venue: selectedPartner.venue_or_promoter_name });
  }

  return (
    <main className="min-h-screen bg-black p-8 font-sans text-white selection:bg-amber-500 selection:text-black md:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col justify-between gap-6 border-b border-zinc-800 pb-6 md:flex-row md:items-center">
          <div><div className="mb-1 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /><span className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">SafariPlug // Command Center</span></div><h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Admin Operations</h1><p className="mt-1 text-sm text-zinc-400">Manage event discovery, partner CRM pipelines, and system telemetry.</p></div>
          <div className="flex flex-wrap items-center gap-2">{(["events", "partners", "analytics"] as const).map((tab) => <button key={tab} onClick={() => selectTab(tab)} className={tabButton(activeTab === tab)}>{tab === "events" ? "Events & Studio" : tab === "partners" ? "Partner CRM" : "Telemetry"}</button>)}</div>
        </header>

        {activeTab === "partners" && <div className="mb-6 flex justify-end"><div className="flex items-center gap-2"><button onClick={() => void handleAIScout()} disabled={scouting} className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs font-bold text-amber-400 transition-colors hover:bg-zinc-800 disabled:opacity-50">{scouting ? "Amani Scouting..." : "Amani AI Scout"}</button><button onClick={() => setShowNewModal(true)} className="rounded-xl bg-amber-500 px-4 py-2 font-mono text-xs font-bold text-black transition-colors hover:bg-amber-400">+ Add Venue Partner</button></div></div>}

        {activeTab === "events" && <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><ModuleCard label="Curation Engine" title="Event Discovery & Approval" description="Review AI-discovered experiences, verify details, approve listings, or manage sponsored slots." href="/admin/ai-events" action="Open Curation Dashboard" /><ModuleCard label="Amani Studio" title="Marketing Studio" description="Generate high-conversion promotional copies for Instagram, WhatsApp, and newsletters from approved events." href="/admin/marketing" action="Open Marketing Studio" /></div>}

        {activeTab === "partners" && <section className="space-y-6"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div className="flex flex-wrap items-center gap-3"><h2 className="font-mono text-lg font-bold tracking-wide text-zinc-200">{"// VENUE PIPELINE"}</h2><div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-0.5"><button onClick={() => setPartnersViewMode("kanban")} className={viewButton(partnersViewMode === "kanban")}>Kanban</button><button onClick={() => setPartnersViewMode("table")} className={viewButton(partnersViewMode === "table")}>Table</button></div></div><button onClick={() => setShowNewModal(true)} className="rounded-xl bg-amber-500 px-4 py-2 font-mono text-xs font-bold text-black hover:bg-amber-400">+ Add Venue Partner</button></div>{loadingPartners ? <Loading text="Loading partner database..." /> : partners.length === 0 ? <Empty text={"No partner records found. Click \"+ Add Venue Partner\" to begin."} /> : partnersViewMode === "kanban" ? <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-4">{STAGES.map((stage) => <div key={stage.key} className="flex min-h-[450px] flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="mb-3 flex items-center justify-between border-b border-zinc-800/80 pb-3 font-mono text-xs"><span className="font-bold uppercase tracking-wider text-zinc-300">{stage.label}</span><span className="rounded bg-zinc-900 px-2 py-0.5 font-bold text-amber-400">{partners.filter((partner) => partner.outreach_stage === stage.key).length}</span></div><div className="flex-1 space-y-3">{partners.filter((partner) => partner.outreach_stage === stage.key).map((partner) => <PartnerCard key={partner.id} partner={partner} onStageChange={updatePartnerStage} onPitch={handleGeneratePitch} />)}</div></div>)}</div> : <PartnerTable partners={partners} onStageChange={updatePartnerStage} onPitch={handleGeneratePitch} />}</section>}

        {activeTab === "analytics" && <section className="space-y-6"><div className="flex items-center justify-between"><h2 className="font-mono text-lg font-bold tracking-wide text-zinc-200">{"// SYSTEM TELEMETRY & ACTIVITY FEED"}</h2><button onClick={() => void fetchTelemetry()} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-amber-400 hover:bg-zinc-800">Refresh Logs</button></div><div className="grid grid-cols-1 gap-6 md:grid-cols-3"><Metric label="Total Telemetry Events" value={telemetry.length} /><Metric label="Pipeline Partners" value={partners.length} /><Metric label="Active Outreach Conversion" value={`${partners.length ? Math.round((partners.filter((partner) => partner.outreach_stage === "partnered").length / partners.length) * 100) : 0}%`} /></div>{loadingTelemetry ? <Loading text="Loading telemetry logs..." /> : telemetry.length === 0 ? <Empty text="No telemetry actions recorded yet." /> : <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950"><table className="w-full text-left font-mono text-xs"><thead><tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-500"><th className="p-4">Action Type</th><th className="p-4">Metadata</th><th className="p-4 text-right">Timestamp</th></tr></thead><tbody>{telemetry.map((log) => <tr key={log.id} className="border-b border-zinc-900 hover:bg-zinc-900/20"><td className="p-4 font-bold text-amber-400">{log.action_type}</td><td className="p-4 text-zinc-400">{JSON.stringify(log.metadata || {})}</td><td className="p-4 text-right text-zinc-500">{new Date(log.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>}

        {showNewModal && <Modal title="Add Venue or Promoter" onClose={() => setShowNewModal(false)}><form onSubmit={handleAddPartner} className="space-y-4 font-mono text-xs">{[["Venue / Promoter Name *", newName, setNewName, true], ["Contact Person", newContact, setNewContact, false], ["Email or Phone", newEmail, setNewEmail, false], ["Instagram Handle", newInstagram, setNewInstagram, false]].map(([label, value, setter, required]) => <label key={label as string} className="block text-zinc-400">{label as string}<input required={required as boolean} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-white outline-none focus:border-amber-500" /></label>)}<div className="flex justify-end gap-3 border-t border-zinc-800 pt-4"><button type="button" onClick={() => setShowNewModal(false)} className="rounded-xl bg-zinc-900 px-4 py-2 text-zinc-300">Cancel</button><button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-black">Save Partner</button></div></form></Modal>}
        {selectedPartner && <Modal title={`Pitch: ${selectedPartner.venue_or_promoter_name}`} onClose={() => setSelectedPartner(null)}><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Amani Tone Selector</span><div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-0.5">{(["energetic", "sophisticated", "direct"] as const).map((option) => <button key={option} onClick={() => updateTone(option)} className={viewButton(tone === option)}>{option}</button>)}</div></div><label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">Recipient Contact:<input value={selectedPartner.email_or_phone || ""} readOnly className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-xs text-zinc-300" /></label><label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400">AI-Crafted Message Draft:<textarea rows={8} value={outreachDraft} onChange={(event) => setOutreachDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-relaxed text-zinc-300 outline-none focus:border-amber-500" /></label></div><div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-zinc-800 pt-4"><button onClick={handleWhatsAppOutreach} disabled={!selectedPartner.email_or_phone} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 font-mono text-xs font-bold text-emerald-300 disabled:bg-zinc-800 disabled:text-zinc-500">Open in WhatsApp</button><button onClick={handleSendEmail} disabled={sending || !selectedPartner.email_or_phone} className="rounded-xl bg-amber-500 px-5 py-2.5 font-mono text-xs font-bold text-black disabled:bg-zinc-800 disabled:text-zinc-500">{sending ? "Dispatching..." : "Send Email via Amani"}</button></div></Modal>}
      </div>
    </main>
  );
}

function tabButton(active: boolean) { return `rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${active ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"}`; }
function viewButton(active: boolean) { return `rounded-lg px-3 py-1 font-mono text-[10px] font-bold capitalize transition-all ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"}`; }
function Loading({ text }: { text: string }) { return <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950 py-20 text-center font-mono text-xs text-zinc-500">{text}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-20 text-center font-mono text-xs text-zinc-500">{text}</div>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</span><p className="mt-2 font-mono text-3xl font-extrabold text-amber-400">{value}</p></div>; }
function ModuleCard({ label, title, description, href, action }: { label: string; title: string; description: string; href: string; action: string }) { return <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition-all hover:border-amber-500/40"><div><span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">{label}</span><h2 className="mt-2 text-xl font-bold">{title}</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p></div><Link href={href} className="mt-8 inline-flex w-fit rounded-xl bg-amber-500 px-4 py-2.5 font-mono text-xs font-bold text-black hover:bg-amber-400">{action} &rarr;</Link></div>; }
function PartnerCard({ partner, onStageChange, onPitch }: { partner: Partner; onStageChange: (id: string, stage: Stage) => void; onPitch: (partner: Partner) => void }) { return <div className="group rounded-xl border border-zinc-800/80 bg-black p-4 shadow-md transition-all hover:border-amber-500/50"><h3 className="mb-1 text-sm font-bold text-white">{partner.venue_or_promoter_name}</h3><p className="mb-2 font-mono text-[11px] text-zinc-400">{partner.contact_person || "No contact assigned"}</p><div className="mt-2 flex items-center justify-between border-t border-zinc-900 pt-3"><select value={partner.outreach_stage} onChange={(event) => onStageChange(partner.id, event.target.value as Stage)} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[10px] text-amber-400 outline-none"><option value="prospect">Prospect</option><option value="contacted">Contacted</option><option value="pitch_sent">Pitch Sent</option><option value="partnered">Partnered</option></select><button onClick={() => onPitch(partner)} className="rounded bg-amber-500 px-2.5 py-1 font-mono text-[10px] font-bold text-black hover:bg-amber-400">Draft Pitch</button></div></div>; }
function PartnerTable({ partners, onStageChange, onPitch }: { partners: Partner[]; onStageChange: (id: string, stage: Stage) => void; onPitch: (partner: Partner) => void }) { return <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl"><table className="w-full border-collapse text-left font-mono text-xs"><thead><tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-500"><th className="p-4">Venue / Promoter</th><th className="p-4">Contact</th><th className="p-4">Email / Phone</th><th className="p-4">Instagram</th><th className="p-4">Stage</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{partners.map((partner) => <tr key={partner.id} className="border-b border-zinc-900 hover:bg-zinc-900/20"><td className="p-4 font-bold text-white">{partner.venue_or_promoter_name}</td><td className="p-4 text-zinc-300">{partner.contact_person || "N/A"}</td><td className="p-4 text-zinc-400">{partner.email_or_phone || "N/A"}</td><td className="p-4 text-zinc-400">{partner.instagram_handle ? `@${partner.instagram_handle}` : "N/A"}</td><td className="p-4"><select value={partner.outreach_stage} onChange={(event) => onStageChange(partner.id, event.target.value as Stage)} className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] uppercase text-amber-400 outline-none"><option value="prospect">Prospect</option><option value="contacted">Contacted</option><option value="pitch_sent">Pitch Sent</option><option value="partnered">Partnered</option></select></td><td className="p-4 text-right"><button onClick={() => onPitch(partner)} className="rounded-lg bg-amber-500 px-3.5 py-1.5 font-bold text-black hover:bg-amber-400">Draft AI Pitch</button></td></tr>)}</tbody></table></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl md:p-8"><div className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4"><h3 className="text-xl font-bold">{title}</h3><button onClick={onClose} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:text-white">Close</button></div>{children}</div></div>; }
