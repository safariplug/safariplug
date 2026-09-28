"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  environment: string;
  displayCurrency: string;
  bookingEnabled: boolean;
  bookingAccessRequired: boolean;
};

type Destination = {
  destinationId: number;
  name: string;
  type: string;
  defaultCurrencyCode?: string | null;
};

export default function ViatorBasicClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [productCode, setProductCode] = useState("");
  const [product, setProduct] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState<"destinations" | "product" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/v1/activities/viator?action=status")
      .then((response) => response.json())
      .then((body) => setStatus(body))
      .catch(() => setStatus(null));
  }, []);

  async function findDestinations(event: FormEvent) {
    event.preventDefault();
    setBusy("destinations");
    setError("");
    try {
      const response = await fetch("/api/v1/activities/viator?action=destinations&q=" + encodeURIComponent(destinationQuery.trim()));
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to load Viator destinations.");
      setDestinations(Array.isArray(body.results) ? body.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Viator destinations.");
    } finally {
      setBusy(null);
    }
  }

  async function lookupProduct(event: FormEvent) {
    event.preventDefault();
    setBusy("product");
    setError("");
    setProduct(null);
    try {
      const response = await fetch("/api/v1/activities/viator?action=product&code=" + encodeURIComponent(productCode.trim()));
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || "Unable to load Viator product.");
      setProduct(body.product || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Viator product.");
    } finally {
      setBusy(null);
    }
  }

  const title = String(product?.title || "");
  const description = String(product?.description || product?.description?.text || "");
  const productUrl = typeof product?.productUrl === "string" ? product.productUrl : "";
  const productStatus = String(product?.status || "");
  const code = String(product?.productCode || productCode || "");
  const image =
    Array.isArray(product?.images) && product.images.length
      ? String(product.images[0]?.variants?.find((row:any)=>row?.height >= 360)?.url || product.images[0]?.variants?.[0]?.url || "")
      : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Viator Basic sandbox</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Integration status</h2>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="rounded-2xl bg-black/[.035] p-4"><strong>Credentials:</strong> {status?.configured ? "Configured" : "Not configured yet"}</div>
          <div className="rounded-2xl bg-black/[.035] p-4"><strong>Environment:</strong> {status?.environment || "sandbox"}</div>
          <div className="rounded-2xl bg-black/[.035] p-4"><strong>Viator display currency:</strong> USD</div>
          <div className="rounded-2xl bg-black/[.035] p-4"><strong>Booking access:</strong> {status?.bookingEnabled ? "Enabled" : "Waiting for Viator approval"}</div>
        </div>

        <form onSubmit={findDestinations} className="mt-7">
          <label className="text-xs font-bold uppercase tracking-[.16em] text-black/35">Destination taxonomy</label>
          <div className="mt-2 flex gap-2">
            <input value={destinationQuery} onChange={(e)=>setDestinationQuery(e.target.value)} placeholder="Nairobi, Mombasa, Diani…" className="min-w-0 flex-1 rounded-xl border border-black/10 px-4 py-3"/>
            <button disabled={busy !== null || !status?.configured} className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy==="destinations"?"Loading…":"Find"}</button>
          </div>
        </form>
        {destinations.length ? <div className="mt-4 max-h-72 space-y-2 overflow-auto">{destinations.map((row)=><div key={row.destinationId} className="rounded-xl border border-black/8 p-3 text-sm"><strong>{row.name}</strong><span className="ml-2 text-black/40">{row.type} · ID {row.destinationId}</span></div>)}</div> : null}

        <form onSubmit={lookupProduct} className="mt-7">
          <label className="text-xs font-bold uppercase tracking-[.16em] text-black/35">Product detail test</label>
          <div className="mt-2 flex gap-2">
            <input value={productCode} onChange={(e)=>setProductCode(e.target.value)} required placeholder="Viator product code" className="min-w-0 flex-1 rounded-xl border border-black/10 px-4 py-3"/>
            <button disabled={busy !== null || !status?.configured} className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy==="product"?"Loading…":"Lookup"}</button>
          </div>
        </form>
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Product preview</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Viator product content</h2>
        {product ? (
          <article className="mt-5 overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-sm">
            {image ? <img src={image} alt="" className="h-64 w-full object-cover" /> : null}
            <div className="p-6">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-black/35">
                <span>Viator</span><span>·</span><span>{productStatus || "Product"}</span><span>·</span><span>{code}</span>
              </div>
              <h3 className="mt-3 text-2xl font-semibold">{title || "Viator experience"}</h3>
              {description ? <p className="mt-3 line-clamp-5 text-sm leading-6 text-black/55">{description}</p> : null}
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Viator products must be presented in a Viator-supported currency. SafariPlug does not display an approximate KES selling price for this inventory.
              </div>
              {status?.bookingEnabled ? (
                <a href={"/checkout/viator?productCode="+encodeURIComponent(code)} className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Continue to Viator checkout →</a>
              ) : productUrl ? (
                <a href={productUrl} className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Open Viator product →</a>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/45">Booking remains disabled until Viator approves Full + Booking Access.</div>
              )}
            </div>
          </article>
        ) : (
          <div className="mt-5 rounded-[1.75rem] border border-dashed border-black/15 bg-white p-8 text-sm leading-6 text-black/50">
            Once the Viator sandbox key is configured, use a product code to verify real product content and affiliate attribution before Booking Access is enabled.
          </div>
        )}
      </section>
    </div>
  );
}
