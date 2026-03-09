/**
 * One-off script: remove black background from Coach B icon so only the
 * character shape remains (transparent background). Run with: npx tsx scripts/remove-icon-background.ts
 */
import sharp from "sharp"
import path from "path"

const IMAGES_DIR = path.join(process.cwd(), "public", "images")
const ICON_PATH = path.join(IMAGES_DIR, "ai-chat-icon.png")
const OUT_PATH = path.join(IMAGES_DIR, "ai-chat-icon-no-bg.png")
const THRESHOLD = 25 // Pixels with luminance below this become transparent (0–255)

async function main() {
  const input = await sharp(ICON_PATH).ensureAlpha().toBuffer()
  const meta = await sharp(input).metadata()
  const { width = 0, height = 0 } = meta

  // Build alpha mask: black/dark pixels -> 0, character pixels -> 255
  const mask = await sharp(input)
    .grayscale()
    .threshold(THRESHOLD)
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Get original RGBA and replace alpha with our mask
  const { data: rgba } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 3; i < rgba.length; i += 4) {
    rgba[i] = mask.data[Math.floor(i / 4)]!
  }

  await sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(OUT_PATH)

  console.log("Done. Wrote ai-chat-icon-no-bg.png with transparent background.")
  console.log("Update the widget to use /images/ai-chat-icon-no-bg.png")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
