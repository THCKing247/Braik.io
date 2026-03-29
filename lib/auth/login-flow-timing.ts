/**
 * Opt-in auth/login performance logging (console).
 *
 * Server (`BRAIK_AUTH_TIMING=1`): login_request_start, login_supabase_signIn_done,
 * login_profile_users_parallel_done, login_parallel_portal_ad_users_done, login_response_ready, dashboard_shell_*.
 *
 * Middleware (`BRAIK_MIDDLEWARE_TIMING=1`): `[braik-middleware-timing]` per request (pathname + ms).
 *
 * Client (`NEXT_PUBLIC_BRAIK_AUTH_TIMING=1` or `window.__BRAIK_AUTH_TIMING__ = true`):
 * sign_in_*, session_fetch_*, session_query_seeded_from_* , login_client_navigate_start,
 * dashboard_shell_query_fetch_*, dashboard_home_mounted, ad_portal_bootstrap_query_fetch_*.
 *
 * Navigation (`NEXT_PUBLIC_BRAIK_NAV_PERF=1` or `window.__BRAIK_NAV_PERF__ = true`):
 * dashboard_shell_fetch_*, ad_portal_bootstrap_fetch_* (dev console).
 */
const serverEnabled = () => process.env.BRAIK_AUTH_TIMING === "1"

export function authTimingServer(label: string, detail?: Record<string, unknown>) {
  if (!serverEnabled()) return
  const t = typeof performance !== "undefined" ? performance.now() : 0
  console.info(`[braik-auth-timing] ${label}`, { ms: Math.round(t), ...detail })
}

export function authTimingClientEnabled(): boolean {
  if (typeof window === "undefined") return false
  if ((window as unknown as { __BRAIK_AUTH_TIMING__?: boolean }).__BRAIK_AUTH_TIMING__ === true) return true
  return process.env.NEXT_PUBLIC_BRAIK_AUTH_TIMING === "1"
}

export function authTimingClient(label: string, detail?: Record<string, unknown>) {
  if (typeof window === "undefined" || !authTimingClientEnabled()) return
  console.info(`[braik-auth-timing] ${label}`, { ms: Math.round(performance.now()), ...detail })
}

export function authTimingMiddleware(pathname: string, elapsedMs: number, extra?: Record<string, unknown>) {
  if (process.env.BRAIK_MIDDLEWARE_TIMING !== "1") return
  console.info("[braik-middleware-timing]", { pathname, ms: elapsedMs, ...extra })
}

/** Dispatched after successful POST /api/auth/login so SessionProvider can seed React Query before `getSession()` resolves. */
export const BRAIK_AUTH_LOGIN_SESSION_EVENT = "braik:auth-login-session"
