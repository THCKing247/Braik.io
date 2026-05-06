#!/usr/bin/env node
/**
 * Phase 8 — reports imports of heavy / sensitive packages (informational by default).
 * HEAVY_IMPORT_AUDIT_STRICT=1 exits 1 if any non-allowlisted hit is found.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

const HEAVY = [
  "jspdf",
  "pdf-lib",
  "html2canvas",
  "mammoth",
  "recharts",
  "stripe",
  "@stripe/stripe-js",
  "openai",
  "twilio",
  "qrcode",
  "@supabase/supabase-js",
  "react-player",
  "video.js",
  "hls.js",
  "chart.js",
  "apexcharts",
]

function loadAllowlist() {
  const p = path.join(ROOT, "performance-budget.config.json")
  const raw = fs.readFileSync(p, "utf8")
  const j = JSON.parse(raw)
  return j.heavyImportAllowlist ?? []
}

function isAllowlisted(relPosix, root, allowlist) {
  for (const rule of allowlist) {
    if (rule.pattern !== root && !root.startsWith(rule.pattern + "/")) continue
    const subs = rule.allowSubstrings ?? []
    if (subs.some((s) => relPosix.includes(s.replace(/\\/g, "/")))) return true
  }
  return false
}

function normalizeRel(p) {
  return p.split(path.sep).join("/")
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) acc.push(full)
  }
  return acc
}

function extractImports(line) {
  const found = []
  const fromM = [...line.matchAll(/from\s+["']([^"']+)["']/g)]
  for (const m of fromM) found.push(m[1])
  const reqM = [...line.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)]
  for (const m of reqM) found.push(m[1])
  return found
}

function pkgRoot(spec) {
  if (spec.startsWith("@")) {
    const parts = spec.split("/")
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec
  }
  return spec.split("/")[0] ?? spec
}

function main() {
  const strict = process.env.HEAVY_IMPORT_AUDIT_STRICT === "1"
  const allowlist = loadAllowlist()

  const dirs = [path.join(ROOT, "app"), path.join(ROOT, "components")]
  const files = []
  for (const d of dirs) files.push(...walk(d))

  const heavySet = new Set(HEAVY)
  let hits = 0
  let unallowlisted = 0

  for (const file of files) {
    const rel = normalizeRel(path.relative(ROOT, file))
    /* Route handlers & server modules — heavy deps here are usually intentional */
    if (rel.startsWith("app/api/")) continue
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split(/\r?\n/)
    lines.forEach((line, i) => {
      const imps = extractImports(line)
      for (const spec of imps) {
        const root = pkgRoot(spec)
        if (!heavySet.has(root)) continue
        hits++
        const ok = isAllowlisted(rel, root, allowlist)
        if (!ok) unallowlisted++
        const flag = ok ? " (allowlisted pattern)" : " **"
        console.log(`  ${rel}:${i + 1} — ${spec}${flag}`)
      }
    })
  }

  console.log("")
  console.log(`[heavy-imports] Reported ${hits} heavy import line(s); ${unallowlisted} not matching allowlist patterns.`)

  if (strict && unallowlisted > 0) {
    console.error("[heavy-imports] Strict mode: unallowlisted imports found.")
    process.exit(1)
  }
  process.exit(0)
}

main()
