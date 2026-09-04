import type { DateMode } from "./params";

export function stillValidFilter(nowIso: string): string {
  return `end_at.gte.${nowIso},and(end_at.is.null,start_at.gte.${nowIso})`;
}

export function kenyaCalendarParts(now = new Date()): {
  kenyaDate: string;
  weekday: string;
} {
  return {
    kenyaDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
    }).format(now),
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
    }).format(now),
  };
}

export function tonightRange(now = new Date()): { start: string; end: string } {
  const { kenyaDate } = kenyaCalendarParts(now);
  return {
    start: new Date(`${kenyaDate}T18:00:00+03:00`).toISOString(),
    end: new Date(`${kenyaDate}T23:59:59+03:00`).toISOString(),
  };
}

export function weekendRange(now = new Date()): { start: string; end: string } {
  const { kenyaDate, weekday } = kenyaCalendarParts(now);
  const weekdayNumbers: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentWeekday = weekdayNumbers[weekday] ?? now.getDay();
  const daysUntilSaturday =
    currentWeekday === 0 ? 1 : currentWeekday === 6 ? 0 : 6 - currentWeekday;
  const nairobiMidnight = new Date(`${kenyaDate}T00:00:00+03:00`);
  const startOfSaturday = new Date(
    nairobiMidnight.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000
  );
  const startOfMonday = new Date(
    startOfSaturday.getTime() + 2 * 24 * 60 * 60 * 1000
  );
  const start = new Date(Math.max(startOfSaturday.getTime(), now.getTime()));
  return { start: start.toISOString(), end: startOfMonday.toISOString() };
}

export function applyDateMode<
  T extends {
    or: (filter: string) => T;
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
    lt: (column: string, value: string) => T;
  },
>(query: T, mode: DateMode, now = new Date()): T {
  const nowIso = now.toISOString();

  if (mode === "all") {
    return query;
  }

  if (mode === "tonight") {
    const range = tonightRange(now);
    return query
      .gte("start_at", range.start)
      .lte("start_at", range.end)
      .or(stillValidFilter(nowIso));
  }

  if (mode === "this-weekend") {
    const range = weekendRange(now);
    return query
      .gte("start_at", range.start)
      .lt("start_at", range.end)
      .or(stillValidFilter(nowIso));
  }

  if (mode === "upcoming") {
    return query.gte("start_at", nowIso);
  }

  return query.or(stillValidFilter(nowIso));
}
