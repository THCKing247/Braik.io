/**
 * Dimensions and paths for optimized marketing assets (see scripts/optimize-landing-images.ts).
 * Regenerate files with: npx tsx scripts/optimize-landing-images.ts
 *
 * Device mockup: `public/open-ai-integration.webp` matches 1536×1024 + alpha (same as former devices-transparent spec).
 * To use `public/images/devices-transparent.webp` instead, add that file and point `webp` below at it.
 */
export const landingDevicesHero = {
  webp: "/open-ai-integration.webp",
  width: 1536,
  height: 1024,
} as const

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
