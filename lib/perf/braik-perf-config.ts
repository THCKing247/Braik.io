/**
 * Braik performance instrumentation — one switch per runtime.
 *
 * Server: set `BRAIK_PERF=1` (recommended for staging/prod spot checks). In `NODE_ENV=development`,
 * instrumentation is on by default so local profiling matches without env.
 *
 * Client: set `NEXT_PUBLIC_BRAIK_PERF=1` for browser console + marks (or rely on development default).
 *
 * Disable in dev: `BRAIK_PERF=0` / `NEXT_PUBLIC_BRAIK_PERF=0` (explicit off wins — see below).
 */

function envTruthy(v: string | undefined): boolean {
  return v === "1" || v === "true"
}

function envExplicitOff(v: string | undefined): boolean {
  return v === "0" || v === "false"
}

/** Server-side structured logs + Server-Timing headers on API routes (not per-request auth by default). */
export function braikPerfServerEnabled(): boolean {
  if (typeof process === "undefined") return false
  if (envExplicitOff(process.env.BRAIK_PERF)) return false
  if (envTruthy(process.env.BRAIK_PERF)) return true
  return process.env.NODE_ENV === "development"
}

/**
 * Per-request `getRequestUserLite` logs (high volume). Enable with `BRAIK_PERF=1` or `BRAIK_PERF_AUTH=1` only.
 */
export function braikPerfAuthVerbose(): boolean {
  if (typeof process === "undefined") return false
  if (envExplicitOff(process.env.BRAIK_PERF_AUTH)) return false
  if (envTruthy(process.env.BRAIK_PERF_AUTH)) return true
  if (envTruthy(process.env.BRAIK_PERF)) return true
  return false
}

/** Browser: route transitions, dashboard ready, optional LCP. */
export function braikPerfClientEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (envExplicitOff(process.env.NEXT_PUBLIC_BRAIK_PERF)) return false
  if (envTruthy(process.env.NEXT_PUBLIC_BRAIK_PERF)) return true
  return process.env.NODE_ENV === "development"
}
