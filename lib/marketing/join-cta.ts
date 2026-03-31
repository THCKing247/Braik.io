import { isWaitlistMode } from "@/lib/config/waitlist-mode"

/** Primary marketing path for “join” CTAs (hero, header, footer). Self-serve signup is disabled. */
export function getPublicJoinHref(_options?: { hero?: boolean }): string {
  if (isWaitlistMode()) return "/waitlist"
  return "/request-access"
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
  return { href: "/request-access", label: "Request access" }
}

export function getAthleticDirectorMarketingHref(): string {
  return isWaitlistMode() ? "/waitlist" : "/request-access"
}
