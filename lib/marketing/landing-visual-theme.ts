/**
 * Reusable Tailwind patterns for the Braik marketing home — navy + orange sports-tech system.
 */

/** Brand accent — use sparingly for highlights, links on dark, key words. */
export const landingAccentHex = "#FF6A00"
export const landingAccentSoft = "#FF9A4D"

/** Inline word highlight (Braik, football, AI, etc.) */
export const landingAccentText = "font-semibold text-[#FF9A4D] drop-shadow-[0_0_12px_rgba(255,106,0,0.25)]"

/** Primary conversion — Request demo */
export const landingCtaPrimaryOrange =
  "inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#FF6A00] px-10 py-6 text-base font-semibold uppercase tracking-wide text-white shadow-[0_0_12px_rgba(255,106,0,0.6)] transition-all duration-200 " +
  "hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_0_22px_rgba(255,106,0,0.85)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A4D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]"

/** Join waitlist / Request access — navy command */
export const landingCtaJoinNavy =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/15 bg-[#0B1220] px-10 py-6 text-base font-semibold uppercase tracking-wide text-white shadow-[0_6px_28px_rgba(0,0,0,0.5)] transition-all duration-200 sm:w-auto " +
  "hover:scale-[1.03] hover:border-white/25 hover:bg-[#0f1f3a] hover:shadow-[0_8px_32px_rgba(0,0,0,0.55)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]"

/** View pricing — orange outline → solid on hover */
export const landingCtaPricingOutline =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#FF6A00] bg-transparent px-10 py-6 text-base font-semibold uppercase tracking-wide text-[#FF6A00] transition-all duration-200 sm:w-auto " +
  "hover:scale-[1.03] hover:bg-[#FF6A00] hover:text-white hover:shadow-[0_0_18px_rgba(255,106,0,0.55)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A4D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]"

/** Deep navy → near-black with blue depth (intensity). */
export const landingDarkSection =
  "relative w-full overflow-hidden py-24 text-white md:py-28 lg:py-32 " +
  "bg-gradient-to-br from-[#05080f] via-[#0a1628] to-[#0c1a3a] " +
  "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_100%_50%_at_50%_-8%,rgba(255,106,0,0.06),transparent_55%)] " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#FF6A00]/35 after:to-transparent"

/** Crisp light bands — optional future imagery; subtle structure. */
export const landingLightSection =
  "relative w-full overflow-hidden bg-white text-slate-900 py-24 md:py-28 lg:py-32 " +
  "shadow-[inset_0_1px_0_0_rgba(148,163,184,0.12)] " +
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[repeating-linear-gradient(90deg,transparent,transparent_3.25rem,rgba(15,23,42,0.028)_3.25rem,rgba(15,23,42,0.028)_calc(3.25rem+1px))]"

/** Final CTA — deep navy + orange rim glow */
export const landingFinalCtaSection =
  "relative w-full overflow-hidden py-28 text-white md:py-32 lg:py-36 " +
  "bg-gradient-to-br from-[#020308] via-[#0a1628] to-[#0f2744] " +
  "ring-1 ring-[#FF6A00]/20 ring-inset " +
  "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_95%_50%_at_50%_-5%,rgba(255,106,0,0.12),transparent_58%)] " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#FF6A00]/40 after:to-transparent"

export const landingContainer = "relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6"

export const landingContainerWide = "relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6"

export const landingH2Dark =
  "text-4xl sm:text-5xl md:text-6xl font-athletic font-bold text-white tracking-tight leading-[1.05]"

export const landingH2Light =
  "text-4xl sm:text-5xl md:text-6xl font-athletic font-bold text-slate-900 tracking-tight leading-[1.05]"

export const landingBodyDark = "text-lg md:text-xl text-slate-200/95 leading-relaxed"

export const landingBodyLight = "text-lg md:text-xl text-slate-600 leading-relaxed"

/** Links on dark gradient — orange accent, not overwhelming */
export const landingLinkOnDark =
  "font-semibold text-[#FF9A4D] underline decoration-[#FF6A00]/45 underline-offset-4 transition hover:text-[#FFB380] hover:decoration-[#FF9A4D]"

/** Links on light sections */
export const landingLinkOnLight =
  "font-medium text-[#ea580c] underline-offset-4 transition hover:text-[#c2410c] hover:underline"
