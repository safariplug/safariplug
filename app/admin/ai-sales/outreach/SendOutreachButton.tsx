"use client";

import { useState } from "react";

type SendOutreachButtonProps = {
  outreachId: string;
  businessName: string;
  contactEmail: string;
};

export default function SendOutreachButton({
  outreachId,
  businessName,
  contactEmail,
}: SendOutreachButtonProps) {
  const [subject, setSubject] = useState(`Partnership opportunity with ${businessName}`);
  const [message, setMessage] = useState(
    `Hello ${businessName},\n\nWe would like to discuss a partnership opportunity with SafariPlug.\n\nBest regards,\nSafariPlug`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_id: outreachId, subject, message }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to send outreach.");
      }

      setResult("Outreach sent.");
      window.location.reload();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to send outreach.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs text-emerald-800">Recipient: {contactEmail || "No email on file"}</p>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Subject"
        className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-sm"
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={5}
        placeholder="Message"
        className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-sm"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending || !contactEmail}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send Outreach"}
      </button>
      {result && <p className="text-xs text-emerald-800">{result}</p>}
    </div>
  );
}