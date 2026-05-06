/**
 * Opt-in verbose API route logging (Phase 9).
 * Set `BRAIK_API_DEBUG=1` on the server (Netlify env). Never enable by default in production.
 */
export function braikApiDebug(...args: unknown[]): void {
  if (process.env.BRAIK_API_DEBUG === "1") {
    console.log(...args)
  }
}
