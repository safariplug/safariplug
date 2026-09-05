"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Find me a great barber in Nairobi this Saturday afternoon",
  "I need a relaxing massage in Nairobi tomorrow after 5 PM",
  "Find a manicure under KES 2,500 this weekend",
];

export default function Concierge() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [registeredClient, setRegisteredClient] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setRegisteredClient(!!user && !user.is_anonymous && !!user.confirmed_at);
      setCheckingAuth(false);
    }

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, user) => {
      if (!mounted) return;
      setRegisteredClient(!!user && !user.is_anonymous && !!user.confirmed_at);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function send(value = text) {
    const content = value.trim();
    if (!content || busy || !registeredClient) return;
    const next = [...messages, { role: "user", content } as Message];
    setMessages(next); setText(""); setBusy(true);
    try {
      const r = await fetch("/api/concierge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === "registered_client_required") {
          setRegisteredClient(false);
          setMessages(messages);
          return;
        }
        throw new Error(j.error || "Concierge unavailable");
      }
      setMessages([...next, { role: "assistant", content: j.message }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? e.message : "I’m unable to help right now. Please try again." }]);
    } finally { setBusy(false); }
  }

  function submit(e: FormEvent) { e.preventDefault(); void send(); }

  if (checkingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f5f2] text-sm text-black/45">Preparing your private concierge…</div>;
  }

  if (!registeredClient) {
    return <div className="min-h-screen bg-[#f6f5f2] text-[#111]">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-16 sm:px-8">
        <div className="grid w-full overflow-hidden rounded-[2.5rem] border border-black/10 bg-white shadow-[0_35px_120px_-50px_rgba(0,0,0,.45)] lg:grid-cols-[1.1fr_.9fr]">
          <div className="bg-black p-8 text-white sm:p-12 lg:p-16">
            <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-white/45">SafariPlug Intelligence</p>
            <div className="mt-16 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl text-black">✦</div>
            <h1 className="mt-7 max-w-xl text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Your personal concierge, reserved for SafariPlug clients.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/55 sm:text-lg">Search real providers, discover live appointment times and arrange bookings through one private, intelligent service.</p>
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14">
            <p className="text-[11px] font-semibold uppercase tracking-[.24em] text-black/35">Client access</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Unlock Concierge</h2>
            <p className="mt-4 text-sm leading-6 text-black/50">Create a free SafariPlug account or sign in to use the full Concierge service. This helps us protect the service from automated and abusive use.</p>
            <div className="mt-8 space-y-3">
              <a href="/login?next=/concierge" className="flex items-center justify-center rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-black/85">Sign in to SafariPlug</a>
              <a href="/login?next=/concierge&mode=signup" className="flex items-center justify-center rounded-2xl border border-black/10 bg-[#fafaf8] px-5 py-4 text-sm font-semibold text-black transition hover:border-black/25">Create a free account</a>
            </div>
            <p className="mt-6 text-center text-[11px] leading-5 text-black/30">Your account also keeps your bookings and Concierge requests connected to you.</p>
          </div>
        </div>
      </section>
    </div>;
  }

  return <div className="min-h-screen bg-[#f6f5f2] text-[#111]">
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pt-16">
      <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
        <div className="lg:sticky lg:top-10">
          <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-black/45">SafariPlug Intelligence</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-[-.055em] sm:text-6xl">Tell us what you need. We’ll find the right place.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-black/55 sm:text-lg">Your personal SafariPlug concierge searches real service providers, checks live appointment times, and can book for you.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {suggestions.map(s => <button key={s} onClick={() => void send(s)} disabled={busy} className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-left text-xs font-medium transition hover:border-black/25 disabled:opacity-50">{s}</button>)}
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 text-xs text-black/50">
            <div className="rounded-2xl border border-black/8 bg-white p-4"><strong className="block text-black">Real</strong>providers</div>
            <div className="rounded-2xl border border-black/8 bg-white p-4"><strong className="block text-black">Live</strong>availability</div>
            <div className="rounded-2xl border border-black/8 bg-white p-4"><strong className="block text-black">Easy</strong>booking</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_100px_-45px_rgba(0,0,0,.45)]">
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 sm:px-7">
            <div><p className="text-sm font-semibold">SafariPlug Concierge</p><p className="mt-0.5 text-[11px] text-black/40">Search · availability · booking</p></div>
            <span className="flex items-center gap-2 text-[11px] font-medium text-black/45"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Live</span>
          </div>
          <div className="min-h-[520px] space-y-4 p-5 sm:p-7">
            {!messages.length && <div className="flex min-h-[430px] items-center justify-center text-center"><div className="max-w-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-xl text-white">✦</div><h2 className="mt-5 text-2xl font-semibold tracking-tight">What can I arrange for you?</h2><p className="mt-3 text-sm leading-6 text-black/45">Try a service, a place, a preferred time, a budget — or simply describe what you’re looking for.</p></div></div>}
            {messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === "user" ? "bg-black text-white" : "bg-[#f5f4f1] text-black/80"}`}>{m.content}</div></div>)}
            {busy && <div className="flex justify-start"><div className="rounded-2xl bg-[#f5f4f1] px-4 py-3 text-sm text-black/45">Checking SafariPlug…</div></div>}
          </div>
          <form onSubmit={submit} className="border-t border-black/8 p-4 sm:p-5"><div className="flex items-end gap-2 rounded-2xl border border-black/10 bg-[#fafaf8] p-2"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} placeholder="e.g. Find me a barber in Westlands Saturday at 3pm…" className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-black/30"/><button disabled={busy || !text.trim()} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-30">{busy ? "…" : "Send"}</button></div><p className="mt-2 px-2 text-[10px] text-black/30">SafariPlug checks live availability before presenting bookable times.</p></form>
        </div>
      </div>
    </section>
  </div>;
}
