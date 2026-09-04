import type { TransferError, TransferErrorCode } from "./types";

export class TransferAdapterError extends Error {
  readonly code: TransferErrorCode;
  readonly retryable: boolean;

  constructor(code: TransferErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "TransferAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function transferError(
  code: TransferErrorCode,
  message: string,
  retryable = false
): TransferError {
  return { code, message, retryable };
}

export function isRetryableTransferError(error: unknown): boolean {
  if (error instanceof TransferAdapterError) return error.retryable;
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as TransferError).retryable);
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
        new TransferAdapterError(
          "timeout",
          `${label} timed out after ${ms}ms.`,
          true
        )
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
      if (!isRetryableTransferError(error) || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw last;
}
