/**
 * Dimensions and paths for optimized marketing assets (see scripts/optimize-landing-images.ts).
 * Regenerate files with: npx tsx scripts/optimize-landing-images.ts
 */

export const braikLogo = {
  webp: "/braik-logo.webp",
  width: 480,
  height: 320,
} as const

/** Home hero background — intrinsic size of `fog-field.webp` (see `scripts/optimize-landing-images.ts`). */
export const landingFogFieldHero = {
  src: "/images/fog-field.webp",
  width: 1024,
  height: 682,
} as const
