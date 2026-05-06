#!/usr/bin/env node
/**
 * Phase 8 — lists "use client" files; flags large files and marketing paths unless allowlisted.
 * Exit 0 by default. USE_CLIENT_AUDIT_STRICT=1 exits 1 if error-level thresholds hit.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function loadConfig() {
  const p = path.join(ROOT, "performance-budget.config.json")
  const raw = fs.readFileSync(p, "utf8")
  const j = JSON.parse(raw)
  return {
    maxUseClientLinesWarning: j.maxUseClientLinesWarning ?? 300,
    maxUseClientLinesError: j.maxUseClientLinesError ?? 600,
    allowedClientGlobs: j.allowedClientGlobs ?? [],
    allowedClientFiles: new Set(
      (j.allowedClientFiles ?? []).map((x) => x.replace(/\\/g, "/"))
    ),
  }
}

function normalizeRel(p) {
  return p.split(path.sep).join("/")
}

/** Minimal glob: ** matches 0+ segments; *.tsx matches file names */
function globMatch(pattern, relPosix) {
  const parts = pattern.split("/").filter(Boolean)
  const segs = relPosix.split("/").filter(Boolean)
  return matchParts(parts, segs, 0, 0)
}

function segmentMatch(token, seg) {
  if (token === "*") return true
  if (token.startsWith("*.")) {
    const suffix = token.slice(1) // e.g. ".tsx"
    return seg.endsWith(suffix)
  }
  return token === seg
}

function matchParts(pat, segs, pi, si) {
  if (pi === pat.length) return si === segs.length
  const token = pat[pi]
  if (token === "**") {
    if (pi === pat.length - 1) return true
    for (let j = si; j <= segs.length; j++) {
      if (matchParts(pat, segs, pi + 1, j)) return true
    }
    return false
  }
  if (si >= segs.length) return false
  if (token === "*" || token.startsWith("*.")) {
    if (!segmentMatch(token, segs[si])) return false
    return matchParts(pat, segs, pi + 1, si + 1)
  }
  if (token !== segs[si]) return false
  return matchParts(pat, segs, pi + 1, si + 1)
}

function isAllowed(relPosix, cfg) {
  if (cfg.allowedClientFiles.has(relPosix)) return true
  for (const g of cfg.allowedClientGlobs) {
    if (globMatch(g, relPosix)) return true
  }
  return false
}

function isMarketingPath(relPosix) {
  return (
    relPosix.includes("/(marketing)/") ||
    relPosix.includes("components/marketing/")
  )
}

function walk(dir, filterExt, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, filterExt, acc)
    else if (filterExt.some((e) => name.endsWith(e))) acc.push(full)
  }
  return acc
}

function hasUseClient(content) {
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (/^\s*["']use client["']\s*;?\s*$/.test(lines[i])) return true
  }
  return false
}

function main() {
  const strict = process.env.USE_CLIENT_AUDIT_STRICT === "1"
  const cfg = loadConfig()

  const dirs = [
    path.join(ROOT, "app"),
    path.join(ROOT, "components"),
  ]

  const candidates = []
  for (const d of dirs) {
    candidates.push(...walk(d, [".tsx", ".ts"]))
  }

  const hits = []
  for (const file of candidates) {
    const content = fs.readFileSync(file, "utf8")
    if (!hasUseClient(content)) continue
    const rel = normalizeRel(path.relative(ROOT, file))
    const lineCount = content.split(/\r?\n/).length
    hits.push({ rel, lineCount })
  }

  hits.sort((a, b) => b.lineCount - a.lineCount)

  console.log(`[use-client] Found ${hits.length} files with "use client".`)
  console.log("")

  let maxSeverity = 0

  for (const h of hits) {
    const marketing = isMarketingPath(h.rel)
    const allowed = isAllowed(h.rel, cfg)
    let tag = ""
    if (h.lineCount >= cfg.maxUseClientLinesError) {
      tag = " [SIZE ERROR]"
      maxSeverity = 2
    } else if (h.lineCount >= cfg.maxUseClientLinesWarning) {
      tag = " [size warn]"
      maxSeverity = Math.max(maxSeverity, 1)
    }
    if (marketing && !allowed) {
      tag += " [marketing — consider Server Component or allowlist]"
      maxSeverity = Math.max(maxSeverity, 1)
    }

    console.log(`  ${h.lineCount} lines${tag} — ${h.rel}`)
  }

  console.log("")
  console.log(
    `[use-client] Thresholds: warn ≥ ${cfg.maxUseClientLinesWarning} lines, error ≥ ${cfg.maxUseClientLinesError} lines`
  )

  if (strict && maxSeverity >= 2) {
    console.error("[use-client] Strict mode: exiting with error.")
    process.exit(1)
  }
  process.exit(0)
}

main()
