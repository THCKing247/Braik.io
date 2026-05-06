/**
 * Logo-aligned Braik athlete portal palette — cyan/sky blue → amber/gold → orange/red.
 * Use via Tailwind arbitrary classes or compose in components.
 */
import { braikBrand, braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

export const braikPlayerChrome = {
  shell: braikPlayerTheme.shell,
  bloomCool:
    `radial-gradient(ellipse 115% 75% at 45% -15%, ${hexToRgba(braikBrand.navy[900], 0.42)}, transparent 52%)`,
  bloomWarm:
    `radial-gradient(ellipse 70% 45% at 98% -5%, ${hexToRgba(braikBrand.orange[500], 0.2)}, transparent 45%)`,
  bloomAccent:
    `radial-gradient(ellipse 55% 40% at 12% 95%, ${hexToRgba(braikBrand.orange[700], 0.18)}, transparent 55%)`,
  /** Primary CTA / Braik gradient button */
  ctaButton:
    "bg-gradient-to-r from-[#F85808] to-[#D83808] text-[#F8F8F8] hover:brightness-105",
  /** Avatar / badge ring */
  avatarRing: "bg-gradient-to-br from-[#F85808] to-[#D83808]",
} as const

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "")
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((c) => `${c}${c}`)
        .join("")
    : normalized
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
