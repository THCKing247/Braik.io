#!/usr/bin/env node
/**
 * Phase 8 — scans `.next/static/chunks/*.js` after `npm run build`.
 * Default: warnings only, exit 0. Set PERF_BUDGET_STRICT=1 to fail on error thresholds.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function loadConfig() {
  const p = path.join(ROOT, "performance-budget.config.json")
  const raw = fs.readFileSync(p, "utf8")
  const j = JSON.parse(raw)
  return {
    maxClientChunkKbWarning: j.maxClientChunkKbWarning ?? 350,
    maxClientChunkKbError: j.maxClientChunkKbError ?? 500,
    maxFirstLoadKbWarning: j.maxFirstLoadKbWarning ?? 300,
    maxFirstLoadKbError: j.maxFirstLoadKbError ?? 450,
  }
}

function walkJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walkJsFiles(full, acc)
    else if (name.endsWith(".js")) acc.push(full)
  }
  return acc
}

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10
}

function main() {
  const strict = process.env.PERF_BUDGET_STRICT === "1"
  const cfg = loadConfig()
  const chunksDir = path.join(ROOT, ".next", "static", "chunks")

  if (!fs.existsSync(chunksDir)) {
    console.log("[bundle-budget] No .next/static/chunks — run `npm run build` first, then re-run.")
    process.exit(0)
  }

  const files = walkJsFiles(chunksDir)
  const sized = files.map((f) => {
    const buf = fs.readFileSync(f)
    const raw = buf.length
    let gz = raw
    try {
      gz = gzipSync(buf).length
    } catch {
      /* ignore */
    }
    const rel = path.relative(ROOT, f).split(path.sep).join("/")
    return { rel, raw, gz }
  })

  sized.sort((a, b) => b.raw - a.raw)

  const maxChunk = sized[0]
  const maxKb = kb(maxChunk.raw)
  const maxGzKb = kb(maxChunk.gz)

  console.log("[bundle-budget] Top client chunks (raw / gzip est.):")
  for (const row of sized.slice(0, 12)) {
    console.log(`  ${kb(row.raw)} KB / ${kb(row.gz)} KB gzip — ${row.rel}`)
  }

  /** Rough shared-js estimate: sum of largest framework + webpack + main-app chunks */
  const frameworkish = sized.filter(
    (s) =>
      /framework-|main-app-|webpack-|polyfills-|main-/.test(path.basename(s.rel)) ||
      s.rel.includes("framework") ||
      s.rel.includes("main-app")
  )
  const approxFirstLoad = frameworkish.reduce((s, x) => s + x.raw, 0)
  const approxKb = kb(approxFirstLoad || maxChunk.raw)

  console.log("")
  console.log(`[bundle-budget] Largest chunk: ${maxKb} KB raw (${maxGzKb} KB gzip) — ${maxChunk.rel}`)
  console.log(
    `[bundle-budget] Approx. shared / entry heuristic sum: ${approxKb} KB raw (see PERFORMANCE_REGRESSION_CHECKLIST.md)`
  )

  let worst = 0

  if (maxKb > cfg.maxClientChunkKbError) {
    console.error(
      `[bundle-budget] ERROR: largest chunk ${maxKb} KB > maxClientChunkKbError (${cfg.maxClientChunkKbError})`
    )
    worst = 2
  } else if (maxKb > cfg.maxClientChunkKbWarning) {
    console.warn(
      `[bundle-budget] WARN: largest chunk ${maxKb} KB > maxClientChunkKbWarning (${cfg.maxClientChunkKbWarning})`
    )
    worst = Math.max(worst, 1)
  }

  if (approxKb > cfg.maxFirstLoadKbError) {
    console.error(
      `[bundle-budget] ERROR: approx first-load heuristic ${approxKb} KB > maxFirstLoadKbError (${cfg.maxFirstLoadKbError})`
    )
    worst = 2
  } else if (approxKb > cfg.maxFirstLoadKbWarning) {
    console.warn(
      `[bundle-budget] WARN: approx first-load heuristic ${approxKb} KB > maxFirstLoadKbWarning (${cfg.maxFirstLoadKbWarning})`
    )
    worst = Math.max(worst, 1)
  }

  if (worst === 0) {
    console.log("[bundle-budget] OK (within thresholds or warning-only mode).")
  }

  if (strict && worst >= 2) {
    process.exit(1)
  }
  process.exit(0)
}

main()
