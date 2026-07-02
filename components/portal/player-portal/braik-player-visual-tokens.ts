/**
 * Braik athlete portal — "sports social" redesign palette.
 * midnight/turf dark surfaces, braik-orange + flame accents.
 */
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

export const braikPlayerChrome = {
  shell: braikPlayerTheme.shell,
  /** warm orange bloom top-left (matches spec radial at 12% -8%) */
  bloomWarm:
    "radial-gradient(900px 500px at 12% -8%, rgba(255,122,51,0.10), transparent 60%)",
  /** cool sky bloom bottom-right */
  bloomCool:
    "radial-gradient(900px 600px at 95% 105%, rgba(77,155,255,0.09), transparent 60%)",
  bloomAccent: "none",
  /** Primary CTA gradient button: braik → flame */
  ctaButton:
    "bg-gradient-to-r from-[#FF7A33] to-[#FF3D1F] text-[#160A02] shadow-[0_10px_24px_-8px_rgba(255,90,30,0.65)] active:scale-[0.96] hover:brightness-105",
  /** Coach role ring — braik orange */
  coachRing: "[box-shadow:0_0_0_2px_#060D22,0_0_0_4px_#FF7A33]",
  /** Team account role ring — sky blue */
  teamRing: "[box-shadow:0_0_0_2px_#060D22,0_0_0_4px_#4D9BFF]",
  /** Avatar / badge ring */
  avatarRing: "bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F]",
} as const
