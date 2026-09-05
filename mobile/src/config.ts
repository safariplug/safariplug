const DEFAULT_API_BASE = "https://safariplug.com";

function readBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return (raw || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export const API_BASE_URL = readBase();
export const API_PREFIX = "/api/v1";
export const REQUEST_TIMEOUT_MS = 15000;
export const PAGE_SIZE = 20;
export const SEARCH_MAX_LENGTH = 80;
