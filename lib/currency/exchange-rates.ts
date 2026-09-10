type ExchangeRateResponse = { result?: string; rates?: Record<string, number> };

type CachedRate = { value: number; expiresAt: number };

const cache = new Map<string, CachedRate>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const BASE_URL = "https://open.er-api.com/v6/latest";

export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) throw new Error("Currency codes are required.");
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(`${BASE_URL}/${encodeURIComponent(from)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to retrieve ${from}/${to} exchange rate.`);
  const data = (await response.json()) as ExchangeRateResponse;
  const rate = Number(data.rates?.[to]);
  if (data.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No live exchange rate is available for ${from}/${to}.`);
  }

  cache.set(key, { value: rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}

export async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<{ amount: number; rate: number; fromCurrency: string; toCurrency: string }> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return {
    amount: Math.round(amount * rate * 100) / 100,
    rate,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
  };
}
