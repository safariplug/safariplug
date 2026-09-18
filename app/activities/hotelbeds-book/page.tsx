"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Preflight = {
  selectionToken: string;
  pricing?: {
    customerRetailAmount?: number;
    customerCurrency?: string;
    supplierAmount?: number;
    supplierCurrency?: string;
  };
  activity?: {
    code?: string;
    name?: string;
    modalityName?: string;
    from?: string;
    to?: string;
    sessionName?: string | null;
    languageName?: string | null;
    rateClass?: string | null;
    freeCancellation?: boolean | null;
    cancellationPolicies?: Array<{ amount?: number | null; dateFrom?: string | null; dateTo?: string | null }>;
    comments?: string[];
    questions?: Array<{ code: string; text: string; required: boolean }>;
    paxes?: Array<{ age: number }>;
  };
};

export default function HotelbedsActivityBookPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const initialToken = params.get("selectionToken") || "";
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [holder, setHolder] = useState({ name: "", surname: "", email: "", phone: "" });
  const [paxes, setPaxes] = useState<Array<{ name: string; surname: string }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialToken) {
      setLoading(false);
      setError("This Hotelbeds activity selection is missing or expired. Please search again.");
      return;
    }

    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/v1/activities/hotelbeds/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "preflight",
            selectionToken: initialToken,
            currency: "KES",
          }),
        });
        const body = await response.json();
        if (response.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!response.ok) throw new Error(body?.message || "Unable to verify this activity rate.");
        if (!cancelled) {
          setPreflight(body);
          const ages = Array.isArray(body?.activity?.paxes) ? body.activity.paxes : [];
          setPaxes(ages.map(() => ({ name: "", surname: "" })));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to verify this activity rate.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [initialToken]);

  function updatePax(index: number, patch: Partial<{ name: string; surname: string }>) {
    setPaxes((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!preflight?.selectionToken) {
      setError("Activity rate verification must finish before payment.");
      return;
    }
    if (!accepted) {
      setError("Review and accept the activity terms before continuing.");
      return;
    }
    if (!holder.name.trim() || !holder.surname.trim() || !holder.email.trim() || !holder.phone.trim()) {
      setError("Holder name, email and international phone are required.");
      return;
    }
    if (paxes.some((pax) => !pax.name.trim() || !pax.surname.trim())) {
      setError("Enter the first and last name for every participant.");
      return;
    }
    const questions = preflight.activity?.questions || [];
    const missing = questions.find((question) => question.required && !answers[question.code]?.trim());
    if (missing) {
      setError(`Answer required: ${missing.text}`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/activities/hotelbeds/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          selectionToken: preflight.selectionToken,
          currency: "KES",
          termsAccepted: true,
          customerPhone: holder.phone.trim(),
          holder: {
            name: holder.name.trim(),
            surname: holder.surname.trim(),
            email: holder.email.trim(),
            phone: holder.phone.trim(),
          },
          paxes: paxes.map((pax) => ({ name: pax.name.trim(), surname: pax.surname.trim() })),
          answers: questions.map((question) => ({
            code: question.code,
            answer: answers[question.code]?.trim() || "",
          })),
        }),
      });
      const body = await response.json();
      if (response.status === 401) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok && body?.error === "traveler_verification_required") {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/account/verification?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) throw new Error(body?.message || "Unable to start activity checkout.");
      if (!body?.bookingId) throw new Error("SafariPlug did not return an activity booking session.");
      window.location.href = `/activities/booking-result?provider=hotelbeds&bookingId=${encodeURIComponent(body.bookingId)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start activity checkout.");
      setSubmitting(false);
    }
  }

  const activity = preflight?.activity;
  const pricing = preflight?.pricing;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-[#111]">
      <div className="mx-auto max-w-5xl">
        <Link href="/activities" className="text-sm font-semibold text-black/55">← Back to activities</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug / Hotelbeds Activities</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{activity?.name || "Review your activity"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
              SafariPlug validates the selected Hotelbeds rate first. The supplier is preconfirmed only after you submit this form, then M-Pesa is started. Final Hotelbeds confirmation happens only after successful payment.
            </p>

            <div className="mt-8 rounded-3xl bg-white p-6">
              <h2 className="font-semibold">Activity details</h2>
              {loading ? <p className="mt-2 text-sm text-black/55">Verifying live rate details…</p> : preflight ? (
                <div className="mt-4 space-y-3 text-sm text-black/60">
                  <Info label="Modality" value={activity?.modalityName || "—"} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Date" value={`${activity?.from || "—"} → ${activity?.to || "—"}`} />
                    <Info label="Rate" value={activity?.rateClass || "Supplier rate"} />
                    {activity?.sessionName ? <Info label="Session" value={activity.sessionName} /> : null}
                    {activity?.languageName ? <Info label="Language" value={activity.languageName} /> : null}
                  </div>

                  <div>
                    <p className="font-semibold text-black/75">Cancellation terms</p>
                    {activity?.cancellationPolicies?.length ? (
                      <ul className="mt-2 space-y-2">
                        {activity.cancellationPolicies.map((policy, index) => (
                          <li key={index} className="rounded-xl bg-black/[.035] p-3">
                            {policy.dateFrom ? `From ${policy.dateFrom}: ` : ""}{pricing?.supplierCurrency || ""} {policy.amount ?? "supplier-defined"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-black/45">{activity?.freeCancellation ? "This rate indicates free cancellation." : "No cancellation-policy rows were returned for this option."}</p>
                    )}
                  </div>

                  {activity?.comments?.length ? (
                    <div>
                      <p className="font-semibold text-black/75">Important supplier information</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">{activity.comments.map((comment, index) => <li key={index}>{comment}</li>)}</ul>
                    </div>
                  ) : null}
                </div>
              ) : <p className="mt-2 text-sm text-red-700">Rate verification is not complete.</p>}
            </div>
          </section>

          <form onSubmit={checkout} className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-black/40">Participants & payment</p>
            <div className="mt-4 rounded-2xl bg-black/[.035] p-4">
              <p className="text-xs text-black/45">Verified SafariPlug total</p>
              <p className="mt-1 text-3xl font-semibold">
                {pricing?.customerCurrency || "KES"} {Number.isFinite(pricing?.customerRetailAmount) ? Number(pricing?.customerRetailAmount).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-black/45">
                Hotelbeds preconfirmation holds the selected activity while M-Pesa is processed. A paid activity is reconfirmed using the supplier reference; SafariPlug does not create a second booking.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <input value={holder.name} onChange={(e) => setHolder({ ...holder, name: e.target.value })} placeholder="Holder first name" className="rounded-xl border border-black/10 px-3 py-3" />
              <input value={holder.surname} onChange={(e) => setHolder({ ...holder, surname: e.target.value })} placeholder="Holder last name" className="rounded-xl border border-black/10 px-3 py-3" />
              <input type="email" value={holder.email} onChange={(e) => setHolder({ ...holder, email: e.target.value })} placeholder="Holder email" className="rounded-xl border border-black/10 px-3 py-3 sm:col-span-2" />
              <input value={holder.phone} onChange={(e) => setHolder({ ...holder, phone: e.target.value })} placeholder="Phone in E.164, e.g. +2547…" className="rounded-xl border border-black/10 px-3 py-3 sm:col-span-2" />
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="font-semibold">Participants</h3>
              {(activity?.paxes || []).map((pax, index) => (
                <div key={index} className="rounded-2xl border border-black/8 p-3">
                  <p className="mb-2 text-xs text-black/40">Participant {index + 1} · age {pax.age}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={paxes[index]?.name || ""} onChange={(e) => updatePax(index, { name: e.target.value })} placeholder="First name" className="rounded-xl border border-black/10 px-3 py-3" />
                    <input value={paxes[index]?.surname || ""} onChange={(e) => updatePax(index, { surname: e.target.value })} placeholder="Last name" className="rounded-xl border border-black/10 px-3 py-3" />
                  </div>
                </div>
              ))}
            </div>

            {activity?.questions?.length ? (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">Supplier questions</h3>
                {activity.questions.map((question) => (
                  <label key={question.code} className="block text-sm">
                    <span className="text-black/60">{question.text}{question.required ? " *" : ""}</span>
                    <input value={answers[question.code] || ""} onChange={(e) => setAnswers({ ...answers, [question.code]: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3" />
                  </label>
                ))}
              </div>
            ) : null}

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-black/8 p-4 text-sm leading-6 text-black/60">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={!preflight || loading} className="mt-1" />
              <span>I reviewed and accept the activity, modality, price, dates, cancellation terms and supplier information shown above.</span>
            </label>

            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <button disabled={submitting || loading || !preflight || !accepted} className="mt-6 w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white disabled:opacity-50">
              {submitting ? "Holding activity & starting M-Pesa…" : loading ? "Verifying activity…" : "Continue with M-Pesa"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black/[.035] p-3"><p className="text-xs text-black/40">{label}</p><p className="mt-1 font-semibold text-black/70">{value}</p></div>;
}
