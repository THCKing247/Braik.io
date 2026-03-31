/**
 * Self-serve signup is off by default. Set `BRAIK_ALLOW_PUBLIC_SIGNUP=true` for local/dev only.
 */
export function isPublicSignupAllowed(): boolean {
  return process.env.BRAIK_ALLOW_PUBLIC_SIGNUP === "true"
}
