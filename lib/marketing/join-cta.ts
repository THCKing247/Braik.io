import { isWaitlistMode } from "@/lib/config/waitlist-mode"

/** Public player onboarding — team join code or QR with code. */
export const PLAYER_SIGNUP_HREF = "/signup/player"

export function getPlayerSignupHref(): string {
  return PLAYER_SIGNUP_HREF
}

/** Coach, school, or program access — waitlist or split-entry request page. */
export function getProgramOrCoachAccessHref(): string {
  if (isWaitlistMode()) return "/waitlist"
  return "/request-access"
}

/**
 * Primary marketing destination for “join Braik as a player” (hero, header, footer).
 * Coach and school flows use {@link getProgramOrCoachAccessHref}.
 */
export function getPublicJoinHref(_options?: { hero?: boolean }): string {
  return getPlayerSignupHref()
}

export function getPricingCalculatorCta(args: {
  planChoice: "head_coach" | "athletic_director"
  headCoachHref: string
}): { href: string; label: string } {
  if (isWaitlistMode()) {
    return { href: "/waitlist", label: "Join the waitlist" }
  }
  if (args.planChoice === "athletic_director") {
    return { href: "/request-access", label: "Request access" }
  }
  return { href: args.headCoachHref, label: "Request access" }
}

export function getAthleticDirectorMarketingHref(): string {
  return isWaitlistMode() ? "/waitlist" : "/request-access"
}

/** Short labels for primary player CTAs (hero, nav, footers). */
export function getPlayerPrimaryCtaLabel(): string {
  return "Join your team"
}

/** Secondary line for “have a code” contexts. */
export function getPlayerSignupSupportingLabel(): string {
  return "Have a team code? Sign up"
}
