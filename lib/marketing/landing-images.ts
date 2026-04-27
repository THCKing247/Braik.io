/**
 * Dimensions and paths for optimized marketing assets (see scripts/optimize-landing-images.ts).
 * Regenerate files with: npx tsx scripts/optimize-landing-images.ts
 */

/** Wide visual beside “One system. Less stress.” — Braik field photography only (no third-party marks). */
export const landingOneSystemPanel = {
  src: "/hero-background.jpg",
  width: 1536,
  height: 1024,
} as const

export const braikLogo = {
  webp: "/braik-logo.webp",
  width: 480,
  height: 480,
} as const

/** Home hero background — intrinsic size of `fog-field.webp` (see `scripts/optimize-landing-images.ts`). */
export const landingFogFieldHero = {
  src: "/images/fog-field.webp",
  width: 1024,
  height: 682,
} as const
