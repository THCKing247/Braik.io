/**
 * HttpOnly flag: user chose “remember me” / long-lived session at last password login.
 * Used when rotating cookies after refresh so short “browser session” logins don’t get
 * upgraded to long maxAge accidentally.
 */
export const BRAIK_PERSIST_SESSION_COOKIE = "braik-persist-session"

export function readPersistLongSessionFromCookies(
  getCookieValue: (cookieName: string) => string | undefined
): boolean {
  return getCookieValue(BRAIK_PERSIST_SESSION_COOKIE) === "1"
}
