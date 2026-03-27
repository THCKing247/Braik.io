/** Default cap so poor networks surface failure instead of hanging indefinitely. */
export const DEFAULT_FETCH_TIMEOUT_MS = 28_000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: outerSignal, ...rest } = init ?? {}
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  outerSignal?.addEventListener("abort", onAbort)
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
    outerSignal?.removeEventListener("abort", onAbort)
  }
}
