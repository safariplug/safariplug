"use client";

import { useState } from "react";

type Draft = {
  recipient: string;
  subject: string;
  message: string;
  missingRequirements: string[];
  followupComparison?: {
    previousSentAt: string;
    resolvedSinceLast: string[];
    stillMissing: string[];
    newlyMissing: string[];
  } | null;
  source?: string;
};

type FollowupHistory = {
  id: string;
  recipientEmail: string;
  subject: string;
  message: string;
  missingRequirements: string[];
  sentAt: string;
  nextFollowupDueAt: string | null;
  status: string;
};

function defaultDueDate() {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

type PreparedDraft = Draft & { id: string; preparedAt: string };

export function SupplierFollowupPanel({ supplierId, eligible, initialHistory, initialPreparedDraft }: { supplierId: string; eligible: boolean; initialHistory: FollowupHistory[]; initialPreparedDraft: PreparedDraft | null }) {
  const [draft, setDraft] = useState<Draft | null>(initialPreparedDraft);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<FollowupHistory[]>(initialHistory);
  const [nextFollowupDate, setNextFollowupDate] = useState(defaultDueDate());

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
        followupComparison: body.followupComparison && typeof body.followupComparison === "object"
          ? {
              previousSentAt: String(body.followupComparison.previousSentAt || ""),
              resolvedSinceLast: Array.isArray(body.followupComparison.resolvedSinceLast) ? body.followupComparison.resolvedSinceLast.map(String) : [],
              stillMissing: Array.isArray(body.followupComparison.stillMissing) ? body.followupComparison.stillMissing.map(String) : [],
              newlyMissing: Array.isArray(body.followupComparison.newlyMissing) ? body.followupComparison.newlyMissing.map(String) : [],
            }
          : null,
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
          nextFollowupDueAt: nextFollowupDate ? `${nextFollowupDate}T09:00:00.000Z` : null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to send supplier follow-up.");
      setNotice(`Email sent to ${body.recipient || draft.recipient}.`);
      if (body.followup) {
        setHistory((current) => [{
          id: String(body.followup.id),
          recipientEmail: String(body.recipient || draft.recipient),
          subject: draft.subject,
          message: draft.message,
          missingRequirements: draft.missingRequirements,
          sentAt: String(body.followup.sent_at || new Date().toISOString()),
          nextFollowupDueAt: body.followup.next_followup_due_at ? String(body.followup.next_followup_due_at) : null,
          status: "sent",
        }, ...current]);
      }
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
      {initialPreparedDraft && draft === initialPreparedDraft && <p className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200">Prepared automatically on {new Date(initialPreparedDraft.preparedAt).toLocaleString()}. Review or regenerate it before sending.</p>}
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

          {draft.followupComparison && (
            <div className="grid gap-3 md:grid-cols-3">
              <ComparisonCard title="Resolved since last email" items={draft.followupComparison.resolvedSinceLast} tone="good" />
              <ComparisonCard title="Still missing" items={draft.followupComparison.stillMissing} tone="warn" />
              <ComparisonCard title="Newly missing" items={draft.followupComparison.newlyMissing} tone="neutral" />
            </div>
          )}

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

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Next follow-up date</span>
            <input
              type="date"
              value={nextFollowupDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setNextFollowupDate(event.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-200 outline-none"
            />
            <span className="mt-1 block text-[10px] text-zinc-500">SafariPlug records this as the next staff review date. It does not send another email automatically.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
            <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-1" />
            <span>I reviewed the recipient, missing requirements, subject and message. I approve this exact email for sending.</span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Draft source: {draft.source === "ai_with_fallback" ? "AI-assisted with deterministic fallback" : draft.source === "scheduled_prepared" ? "scheduled factual preparation" : "deterministic onboarding facts"}.</p>
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
      <div className="mt-6 border-t border-zinc-800 pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Follow-up history</p>
            <h3 className="mt-1 font-semibold">{history.length} recorded email{history.length === 1 ? "" : "s"}</h3>
          </div>
          {history[0]?.nextFollowupDueAt && (
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${Date.parse(history[0].nextFollowupDueAt) <= Date.now() ? "bg-red-950 text-red-300" : "bg-amber-950 text-amber-300"}`}>
              {Date.parse(history[0].nextFollowupDueAt) <= Date.now() ? "Follow-up overdue" : "Waiting on supplier"}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {history.map((item) => (
            <details key={item.id} className="rounded-xl border border-zinc-800 bg-black p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.subject}</p>
                    <p className="mt-1 text-xs text-zinc-500">Sent {new Date(item.sentAt).toLocaleString()} · {item.recipientEmail}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {item.nextFollowupDueAt ? `Next review ${new Date(item.nextFollowupDueAt).toLocaleDateString()}` : "No next date"}
                  </span>
                </div>
              </summary>
              <div className="mt-4 border-t border-zinc-800 pt-4">
                {item.missingRequirements.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Missing items snapshot</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-400">{item.missingRequirements.map((value) => <li key={value}>• {value}</li>)}</ul>
                  </div>
                )}
                <p className="mt-4 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{item.message}</p>
              </div>
            </details>
          ))}
          {!history.length && <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No onboarding follow-up email has been recorded yet.</p>}
        </div>
      </div>
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

function ComparisonCard({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" | "neutral" }) {
  const cls = tone === "good" ? "border-emerald-900/60 bg-emerald-950/20" : tone === "warn" ? "border-amber-900/60 bg-amber-950/20" : "border-zinc-800 bg-black";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      {items.length ? <ul className="mt-2 space-y-1 text-xs text-zinc-300">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-xs text-zinc-500">None</p>}
    </div>
  );
}
