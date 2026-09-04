import type { CatalogEvent } from "../models/event";

export function formatPrice(
  price: number | null | undefined,
  currency: string | null | undefined
): string {
  if (price == null || !Number.isFinite(price)) return "Price TBA";
  const code = (currency || "").trim().toUpperCase();
  try {
    if (code && /^[A-Z]{3}$/.test(code)) {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: code,
        maximumFractionDigits: price % 1 === 0 ? 0 : 2,
      }).format(price);
    }
  } catch {
    // fall through
  }
  return code ? `${code} ${price}` : String(price);
}

export function formatEventWhen(
  startAt: string | null,
  endAt: string | null
): string | null {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  };
  const startLabel = new Intl.DateTimeFormat("en-GB", opts).format(start);
  if (!endAt) return startLabel;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel} – ${new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(end)}`;
}

export function cityLabel(event: CatalogEvent): string | null {
  return event.city?.name || null;
}

export function venueLine(event: CatalogEvent): string | null {
  const parts = [event.venue_name, event.city?.name].filter(Boolean);
  return parts.length ? parts.join(" · ") : event.venue_address;
}
