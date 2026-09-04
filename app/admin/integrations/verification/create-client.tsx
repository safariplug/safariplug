"use client";

import { useState, type FormEvent } from "react";

export function CreateCaseForm() {
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("basic");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject_type: "driver",
        subject_id: subjectId,
        verification_level: level,
      }),
    });
    const json = (await response.json()) as {
      success?: boolean;
      error?: { message?: string };
    };
    setBusy(false);
    if (!response.ok || json.success === false) {
      setError(json.error?.message || "Could not create case");
      return;
    }
    window.location.reload();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        Open a case
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input
          required
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          placeholder="Driver UUID"
          className="rounded-lg border border-zinc-800 bg-black px-3 py-2 font-mono text-[11px] text-zinc-300"
        />
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="rounded-lg border border-zinc-800 bg-black px-3 py-2 font-mono text-[11px] text-amber-400"
        >
          <option value="basic">basic</option>
          <option value="identity">identity</option>
          <option value="enhanced">enhanced</option>
        </select>
        <button
          disabled={busy}
          className="rounded-lg bg-amber-500 px-3 py-2 font-mono text-[11px] font-bold text-black"
        >
          Create case
        </button>
      </div>
      {error ? <p className="mt-2 font-mono text-[11px] text-red-400">{error}</p> : null}
    </form>
  );
}
