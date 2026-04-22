/**
 * Logo-aligned Braik athlete portal palette — cyan/sky blue → amber/gold → orange/red.
 * Use via Tailwind arbitrary classes or compose in components.
 */

export const braikPlayerChrome = {
  shell:
    "bg-[#040a12] bg-gradient-to-b from-[#050c14] via-[#071226] to-[#120714]",
  bloomCool:
    "radial-gradient(ellipse 115% 75% at 45% -15%, rgba(56,189,248,0.26), transparent 52%)",
  bloomWarm:
    "radial-gradient(ellipse 70% 45% at 98% -5%, rgba(249,115,22,0.18), transparent 45%)",
  bloomAccent:
    "radial-gradient(ellipse 55% 40% at 12% 95%, rgba(251,191,36,0.14), transparent 55%)",
  /** Primary CTA / Braik gradient button */
  ctaButton:
    "bg-gradient-to-r from-sky-600 via-amber-500 to-orange-600 hover:brightness-105",
  /** Avatar / badge ring */
  avatarRing: "bg-gradient-to-br from-sky-400 via-amber-400 to-orange-600",
} as const
