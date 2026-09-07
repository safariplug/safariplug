import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { apiGet } from "./api/client";

export const DISPLAY_CURRENCIES = [
  "KES", "USD", "EUR", "GBP", "TZS", "UGX", "RWF", "ZAR", "AED", "CHF", "CAD", "AUD",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

type FxData = {
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
};

type FxContextValue = {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  rates: Record<string, number>;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
  convert: (amount: number | null | undefined, sourceCurrency: string | null | undefined) => number | null;
};

const FxContext = createContext<FxContextValue | null>(null);

export function convertCurrency(
  amount: number | null | undefined,
  sourceCurrency: string | null | undefined,
  targetCurrency: string,
  rates: Record<string, number>
): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const source = (sourceCurrency || "").trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  if (!source || !rates[source] || !rates[target]) return amount;
  if (source === target) return amount;
  return (amount / rates[source]) * rates[target];
}

export function FxProvider({ children }: PropsWithChildren) {
  const [currency, setCurrency] = useState<DisplayCurrency>("KES");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, KES: 1 });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<FxData>("/fx")
      .then((result) => {
        if (!active) return;
        const nextRates = result.data.rates;
        if (!nextRates) throw new Error("Live FX rates were not returned.");
        setRates(nextRates);
        setUpdatedAt(result.data.time_last_update_utc || null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Live FX rates unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<FxContextValue>(() => ({
    currency,
    setCurrency,
    rates,
    updatedAt,
    loading,
    error,
    convert: (amount, sourceCurrency) => convertCurrency(amount, sourceCurrency, currency, rates),
  }), [currency, rates, updatedAt, loading, error]);

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx() {
  const value = useContext(FxContext);
  if (!value) throw new Error("useFx must be used inside FxProvider");
  return value;
}
