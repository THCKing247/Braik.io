/**
 * One-off / CI: resize and compress marketing hero + logo assets.
 * Run: npx tsx scripts/optimize-landing-images.ts
 */
import { renameSync, unlinkSync } from "fs"
import { join } from "path"
import sharp from "sharp"

const publicDir = join(process.cwd(), "public")

async function optimizeDevicesHero() {
  const input = join(publicDir, "images/devices-transparent.png")
  const meta = await sharp(input).metadata()
  const w = meta.width ?? 1600
  const targetW = Math.min(w, 1600)
  const pipeline = sharp(input).resize({
    width: targetW,
    withoutEnlargement: true,
  })

  const webpPath = join(publicDir, "images/devices-transparent.webp")
  const pngTmp = join(publicDir, "images/devices-transparent.opt.tmp.png")
  const pngPath = join(publicDir, "images/devices-transparent.png")

  await pipeline
    .clone()
    .webp({ quality: 82, alphaQuality: 100, effort: 6 })
    .toFile(webpPath)

  await pipeline
    .clone()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
      quality: 82,
      effort: 10,
    })
    .toFile(pngTmp)

  try {
    unlinkSync(pngPath)
  } catch {
    /* ignore */
  }
  renameSync(pngTmp, pngPath)

  const outMeta = await sharp(pngPath).metadata()

  console.log("devices-transparent:", { webp: webpPath, png: pngPath, ...outMeta })
  console.log("If width/height changed, update lib/marketing/landing-images.ts (landingDevicesHero, braikLogo).")
}

async function optimizeLogo() {
  const input = join(publicDir, "braik-logo.png")
  const meta = await sharp(input).metadata()
  const w = meta.width ?? 800
  // Header displays ~200px wide; 2x = 400px, allow a little headroom
  const targetW = Math.min(w, 480)
  const pipeline = sharp(input).resize({
    width: targetW,
    withoutEnlargement: true,
  })

  const webpPath = join(publicDir, "braik-logo.webp")
  const pngTmp = join(publicDir, "braik-logo.opt.tmp.png")
  const pngPath = join(publicDir, "braik-logo.png")

  await pipeline.clone().webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(webpPath)

  await pipeline.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(pngTmp)

  try {
    unlinkSync(pngPath)
  } catch {
    /* ignore */
  }
  renameSync(pngTmp, pngPath)

  const outMeta = await sharp(pngPath).metadata()

  console.log("braik-logo:", { webp: webpPath, png: pngPath, ...outMeta })
}

/** Home hero — cap width so next/image has a smaller source PNG (also writes WebP alongside for static hosts). */
async function optimizeFogFieldHero() {
  const input = join(publicDir, "images/fog-field.png")
  const pngTmp = join(publicDir, "images/fog-field.opt.tmp.png")
  const pngPath = join(publicDir, "images/fog-field.png")
  const webpPath = join(publicDir, "images/fog-field.webp")
  const meta = await sharp(input).metadata()
  const w = meta.width ?? 1920
  const targetW = Math.min(w, 1920)
  const pipeline = sharp(input).resize({ width: targetW, withoutEnlargement: true })

  await pipeline.clone().webp({ quality: 82, effort: 6 }).toFile(webpPath)

  await pipeline
    .clone()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toFile(pngTmp)

  try {
    unlinkSync(pngPath)
  } catch {
    /* ignore */
  }
  renameSync(pngTmp, pngPath)

  const outMeta = await sharp(pngPath).metadata()
  console.log("fog-field:", { png: pngPath, webp: webpPath, ...outMeta })
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
