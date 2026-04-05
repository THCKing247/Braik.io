/**
 * Dimensions and paths for optimized marketing assets (see scripts/optimize-landing-images.ts).
 * Regenerate files with: npx tsx scripts/optimize-landing-images.ts
 */
export const landingDevicesHero = {
  webp: "/images/devices-transparent.webp",
  png: "/images/devices-transparent.png",
  width: 1536,
  height: 1024,
} as const

export const braikLogo = {
  webp: "/braik-logo.webp",
  png: "/braik-logo.png",
  width: 480,
  height: 320,
} as const

/** Home hero background — max dimensions; run `scripts/optimize-landing-images.ts` to resize source PNG. */
export const landingFogFieldHero = {
  src: "/images/fog-field.png",
  width: 1920,
  height: 1080,
} as const
