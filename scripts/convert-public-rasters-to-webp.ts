/**
 * One-off: convert public PNG/JPEG rasters to WebP (quality ~82, preserve alpha for PNG).
 * Run: npx tsx scripts/convert-public-rasters-to-webp.ts
 */
import { readdirSync, statSync } from "fs"
import { join, extname, basename } from "path"
import sharp from "sharp"

const publicDir = join(process.cwd(), "public")

const WEBP_QUALITY = 82
const WEBP_ALPHA_QUALITY = 100
const WEBP_EFFORT = 6

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

/** Raster paths under public/ to convert (excludes unreferenced orphans like hero-background.jpg). */
const INCLUDE_RELATIVE = new Set<string>([
  "braik-logo.png",
  "diagram-hero-page-1.png",
  "images/ai-chat-icon-tmp.png",
  "images/fog-field.png",
  ...[
    "chinstrap.png",
    "cleats.png",
    "equipment_bag.png",
    "football.png",
    "football_pants.png",
    "gloves.png",
    "helmet.png",
    "jersey.png",
    "knee_pad.png",
    "lock.png",
    "locker.png",
    "mouthguard.png",
    "shoulder_pads.png",
    "water_bottle.png",
    "whistle.png",
  ].map((n) => `images/inventory/${n}`),
])

async function main() {
  const files = walk(publicDir).filter((f) => {
    const ext = extname(f).toLowerCase()
    if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") return false
    const rel = f.replace(publicDir + "\\", "").replace(publicDir + "/", "").replace(/\\/g, "/")
    return INCLUDE_RELATIVE.has(rel)
  })

  for (const input of files) {
    const out = input.replace(/\.(png|jpe?g)$/i, ".webp")
    if (out === input) continue
    const meta = await sharp(input).metadata()
    const hasAlpha = !!meta.hasAlpha
    const isJpeg = /\.jpe?g$/i.test(input)

    const pipeline = sharp(input)
    if (isJpeg) {
      await pipeline.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT }).toFile(out)
    } else {
      await pipeline
        .webp({
          quality: WEBP_QUALITY,
          alphaQuality: hasAlpha ? WEBP_ALPHA_QUALITY : WEBP_QUALITY,
          effort: WEBP_EFFORT,
        })
        .toFile(out)
    }

    const inStat = statSync(input)
    const outStat = statSync(out)
    console.log(
      `${basename(input)} -> ${basename(out)} (${inStat.size} -> ${outStat.size} bytes, alpha=${hasAlpha})`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
