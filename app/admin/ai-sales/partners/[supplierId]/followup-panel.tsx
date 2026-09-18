"use client";

import { useState } from "react";

type Draft = {
  recipient: string;
  subject: string;
  message: string;
  missingRequirements: string[];
  source?: string;
};

export function SupplierFollowupPanel({ supplierId, eligible }: { supplierId: string; eligible: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState("");

  async function generate() {
    setLoading(true);
    setNotice("");
    setApproved(false);
    try {
      const response = await fetch("/api/admin/suppliers/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ supplierId, action: "draft" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to draft supplier follow-up.");
      setDraft({
        recipient: String(body.recipient || ""),
        subject: String(body.subject || ""),
        message: String(body.message || ""),
        missingRequirements: Array.isArray(body.missingRequirements) ? body.missingRequirements.map(String) : [],
        source: body.source ? String(body.source) : undefined,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to draft supplier follow-up.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!draft || !approved || sending) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/suppliers/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId,
          action: "send",
          subject: draft.subject,
          message: draft.message,
          approved: true,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to send supplier follow-up.");
      setNotice(`Email sent to ${body.recipient || draft.recipient}.`);
      setApproved(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to send supplier follow-up.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="onboarding-followup" className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Onboarding follow-up</p>
          <h2 className="mt-2 text-xl font-semibold">Draft exactly what this supplier still needs</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">SafariPlug reads the recorded onboarding state and prepares a factual email for staff review. Nothing is sent until you approve the exact message.</p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!eligible || loading || sending}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          {loading ? "Drafting…" : draft ? "Regenerate draft" : "Draft missing-items email"}
        </button>
      </div>

      {!eligible && <p className="mt-4 rounded-xl border border-zinc-800 p-4 text-sm text-zinc-500">Follow-up drafting is available while onboarding is draft, in progress, or changes are requested.</p>}
      {notice && <p className="mt-4 rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-300">{notice}</p>}

      {draft && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-black p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">Detected missing requirements</p>
            {draft.missingRequirements.length ? (
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {draft.missingRequirements.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No specific missing requirement was detected beyond the recorded incomplete onboarding state.</p>
            )}
          </div>

          <Field label="Recipient" value={draft.recipient} readOnly />
          <Field label="Subject" value={draft.subject} onChange={(value) => setDraft((current) => current ? { ...current, subject: value } : current)} />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Message</span>
            <textarea
              value={draft.message}
              onChange={(event) => setDraft((current) => current ? { ...current, message: event.target.value } : current)}
              rows={12}
              className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-200 outline-none"
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
            <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-1" />
            <span>I reviewed the recipient, missing requirements, subject and message. I approve this exact email for sending.</span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Draft source: {draft.source === "ai_with_fallback" ? "AI-assisted with deterministic fallback" : "deterministic onboarding facts"}.</p>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!approved || sending || !draft.subject.trim() || !draft.message.trim()}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send approved email"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value, readOnly, onChange }: { label: string; value: string; readOnly?: boolean; onChange?: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-200 outline-none read-only:text-zinc-500"
      />
    </label>
  );
}
