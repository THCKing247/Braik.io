import { isWaitlistMode } from "@/lib/config/waitlist-mode"

/** Primary marketing path for “join” CTAs (hero, header, footer). */
export function getPublicJoinHref(options?: { hero?: boolean }): string {
  if (isWaitlistMode()) return "/waitlist"
  if (options?.hero) return "/signup/role?fromHero=1"
  return "/signup/role"
}

export function getPricingCalculatorCta(args: {
  planChoice: "head_coach" | "athletic_director"
  headCoachHref: string
}): { href: string; label: string } {
  if (isWaitlistMode()) {
    return { href: "/waitlist", label: "Join the waitlist" }
  }
  if (args.planChoice === "athletic_director") {
    return { href: "/signup/athletic-director", label: "Start Athletic Director setup" }
  }
  return { href: args.headCoachHref, label: "Start your program" }
}

export function getAthleticDirectorMarketingHref(): string {
  return isWaitlistMode() ? "/waitlist" : "/signup/athletic-director"
}
