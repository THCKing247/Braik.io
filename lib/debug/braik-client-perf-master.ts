/**
 * Master switch for client-side perf console instrumentation (Phases 3 / 10).
 * When `NEXT_PUBLIC_BRAIK_PERF=1`, individual hooks (nav, shell, bootstrap, auth timing) turn on
 * without setting each `NEXT_PUBLIC_BRAIK_*` flag. Never enable in production by default.
 */
export function braikClientPerfBundleEnabled(): boolean {
  if (typeof window === "undefined") return false
  return process.env.NEXT_PUBLIC_BRAIK_PERF === "1"
}
