/**
 * Fetch wrapper enforcing a strict 5-second AbortController timeout for external APIs.
 */

export const EXTERNAL_FETCH_TIMEOUT_MS = 5000;

/**
 * Executes a fetch request with an AbortController timeout and no-store caching.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}
