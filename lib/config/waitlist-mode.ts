/**
 * Public registration gate.
 *
 * Default: waitlist mode is ON (self-serve signup hidden unless a signup session cookie is set,
 * e.g. after a validated parent player code).
 *
 * Set `NEXT_PUBLIC_WAITLIST_MODE=false` or `0` in `.env.local` to restore the legacy signup flow.
 */
export function isWaitlistMode(): boolean {
  const v = process.env.NEXT_PUBLIC_WAITLIST_MODE
  if (v === "false" || v === "0") return false
  return true
}
