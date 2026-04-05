/**
 * Reusable Tailwind patterns for the Braik marketing home — premium football / sports-tech rhythm.
 */

/** Deep navy → Braik blue gradient bands (intensity, momentum). */
export const landingDarkSection =
  "relative w-full overflow-hidden py-24 md:py-28 lg:py-32 text-white " +
  "bg-gradient-to-br from-slate-950 via-[#0a1628] to-blue-950 " +
  "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_100%_55%_at_50%_-10%,rgba(59,130,246,0.14),transparent_55%)] " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent"

/** Crisp light bands — ready for optional absolute bg image + overlay layers. */
export const landingLightSection =
  "relative w-full overflow-hidden bg-white text-gray-900 py-20 md:py-24 " +
  "shadow-[inset_0_1px_0_0_rgba(148,163,184,0.12)] " +
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[repeating-linear-gradient(90deg,transparent,transparent_3.25rem,rgba(15,23,42,0.035)_3.25rem,rgba(15,23,42,0.035)_calc(3.25rem+1px))]"

/** Final conversion band — slightly deeper, stadium-adjacent energy. */
export const landingFinalCtaSection =
  "relative w-full overflow-hidden py-28 md:py-32 lg:py-36 text-white " +
  "bg-gradient-to-br from-[#020617] via-blue-950 to-[#143d6b] " +
  "ring-1 ring-white/10 ring-inset " +
  "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_95%_55%_at_50%_-5%,rgba(59,130,246,0.2),transparent_58%)] " +
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-blue-400/25 after:to-transparent"

/** Centered content column — standard width. */
export const landingContainer = "relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6"

/** Wider hero / full-bleed moments. */
export const landingContainerWide = "relative z-10 mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10"

/** Split content + image columns on marketing home (readable line length + placeholders). */
export const landingContainerSplit =
  "relative z-10 mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10"

/** Section headings — dark bands: commanding, athletic. */
export const landingH2Dark =
  "text-4xl sm:text-5xl md:text-6xl font-athletic font-bold text-white tracking-tight leading-[1.05]"

/** Section headings — light bands. */
export const landingH2Light =
  "font-athletic text-2xl font-bold tracking-tight text-gray-900 md:text-4xl"

/** Body copy on dark sections. */
export const landingBodyDark = "text-lg md:text-xl text-slate-200/95 leading-relaxed"

/** Body copy on light sections. */
export const landingBodyLight = "text-base leading-relaxed text-gray-800 md:text-lg"

/** Primary text link on dark gradient. */
export const landingLinkOnDark =
  "font-semibold text-white underline decoration-blue-300/70 underline-offset-4 transition hover:text-blue-100 hover:decoration-blue-200"
