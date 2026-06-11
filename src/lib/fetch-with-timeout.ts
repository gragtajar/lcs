// fetch wrapper with a timeout (addendum T6.4).
//
// Uses AbortSignal.timeout for the cleanest implementation and AbortSignal.any
// to compose with a caller-provided signal. Throws a typed NetworkTimeoutError
// on abort so callers can degrade gracefully.

import { NetworkTimeoutError } from './errors';

const DEFAULT_TIMEOUT_MS = 8_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  try {
    return await fetch(url, { ...options, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NetworkTimeoutError(`Fetch to ${url} aborted after ${timeoutMs}ms`, url, timeoutMs);
    }
    throw err;
  }
}
