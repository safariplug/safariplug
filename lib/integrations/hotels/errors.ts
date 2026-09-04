import type { HotelError, HotelErrorCode } from "./types";

export class HotelAdapterError extends Error {
  readonly code: HotelErrorCode;
  readonly retryable: boolean;

  constructor(code: HotelErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "HotelAdapterError";
    this.code = code;
    this.retryable = retryable;
  }

  toError(): HotelError {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export function hotelError(
  code: HotelErrorCode,
  message: string,
  retryable = false
): HotelError {
  return { code, message, retryable };
}

export function isRetryableHotelError(error: unknown): boolean {
  if (error instanceof HotelAdapterError) return error.retryable;
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as HotelError).retryable);
  }
  return false;
}

export async function withTimeout<T>(
  operation: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new HotelAdapterError("timeout", `${label} timed out after ${ms}ms.`, true)
      );
    }, ms);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retryIfSafe<T>(
  operation: () => Promise<T>,
  attempts = 2,
  baseDelayMs = 50
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      if (!isRetryableHotelError(error) || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw last;
}
