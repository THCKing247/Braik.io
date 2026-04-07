/**
 * One-off / CI: resize and compress marketing hero + logo assets.
 * Run: npx tsx scripts/optimize-landing-images.ts
 *
 * Sources may be PNG (legacy) or WebP; outputs WebP. Skips missing assets (e.g. devices mockup not in repo).
 */
import { existsSync } from "fs"
import { join } from "path"
import sharp from "sharp"

const publicDir = join(process.cwd(), "public")

function pickSource(preferredPng: string, fallbackWebp: string): string | null {
  if (existsSync(preferredPng)) return preferredPng
  if (existsSync(fallbackWebp)) return fallbackWebp
  return null
}

async function optimizeDevicesHero() {
  const pngPath = join(publicDir, "images/devices-transparent.png")
  const webpPath = join(publicDir, "images/devices-transparent.webp")
  const input = pickSource(pngPath, webpPath)
  if (!input) {
    console.warn("devices-transparent: skip (no devices-transparent.png or .webp in public/images)")
    return
  }

  const meta = await sharp(input).metadata()
  const w = meta.width ?? 1600
  const targetW = Math.min(w, 1600)
  const pipeline = sharp(input).resize({
    width: targetW,
    withoutEnlargement: true,
  })

  await pipeline.clone().webp({ quality: 82, alphaQuality: 100, effort: 6 }).toFile(webpPath)

  const outMeta = await sharp(webpPath).metadata()
  console.log("devices-transparent:", { webp: webpPath, ...outMeta })
  console.log("If width/height changed, update lib/marketing/landing-images.ts (landingDevicesHero, braikLogo).")
}

async function optimizeLogo() {
  const pngPath = join(publicDir, "braik-logo.png")
  const webpPath = join(publicDir, "braik-logo.webp")
  const input = pickSource(pngPath, webpPath)
  if (!input) {
    console.warn("braik-logo: skip (no braik-logo.png or braik-logo.webp)")
    return
  }

  const meta = await sharp(input).metadata()
  const w = meta.width ?? 800
  const targetW = Math.min(w, 480)
  const pipeline = sharp(input).resize({
    width: targetW,
    withoutEnlargement: true,
  })

  await pipeline.clone().webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(webpPath)

  const outMeta = await sharp(webpPath).metadata()
  console.log("braik-logo:", { webp: webpPath, ...outMeta })
}

/** Home hero — cap width for next/image. */
async function optimizeFogFieldHero() {
  const pngPath = join(publicDir, "images/fog-field.png")
  const webpPath = join(publicDir, "images/fog-field.webp")
  const input = pickSource(pngPath, webpPath)
  if (!input) {
    console.warn("fog-field: skip (no fog-field.png or fog-field.webp)")
    return
  }

  const meta = await sharp(input).metadata()
  const w = meta.width ?? 1920
  const targetW = Math.min(w, 1920)
  const pipeline = sharp(input).resize({ width: targetW, withoutEnlargement: true })

  await pipeline.clone().webp({ quality: 82, effort: 6 }).toFile(webpPath)

  const outMeta = await sharp(webpPath).metadata()
  console.log("fog-field:", { webp: webpPath, ...outMeta })
  console.log("If width/height changed, update lib/marketing/landing-images.ts (landingFogFieldHero).")
}

async function main() {
  await optimizeDevicesHero()
  await optimizeLogo()
  await optimizeFogFieldHero()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
