# Phase 8 — Performance guardrails (report)

Adds documentation, npm scripts, and CI-friendly audits so Braik performance stays intentional after Phases 0–7. **No product behavior or schema changes.**

## Files added / updated

| Path | Role |
|------|------|
| `PERFORMANCE_GUIDELINES.md` | Principles: RSC vs client, dynamic imports, heavy libs, media, mobile, DB, realtime, React Query, PR checklist |
| `PERFORMANCE_REGRESSION_CHECKLIST.md` | Local profiling, `analyze`, `NEXT_PUBLIC_BRAIK_PERF`, scenarios, metrics to record |
| `.github/pull_request_template.md` | Concise **Performance checklist** block |
| `performance-budget.config.json` | Chunk / first-load thresholds; line-count thresholds for use-client audit; allowlists (`allowedClientGlobs`, `heavyImportAllowlist`) |
| `scripts/check-bundle-budget.mjs` | Post-build scan of `.next/static/chunks/**/*.js` + gzip estimates |
| `scripts/audit-use-client.mjs` | Lists `"use client"` files; line-count tiers; marketing path hints vs allowlist |
| `scripts/audit-heavy-client-imports.mjs` | Reports imports of configured heavy packages (`app/` + `components/`, excludes `app/api/`) |
| `package.json` | `perf:bundle`, `perf:audit`, `perf:audit:strict` |
| `.github/workflows/deploy-guard.yml` | Runs `npm run perf:audit` after build (informational, exit 0 with default settings) |
| `next.config.js` | One-line pointer to analyzer docs |

## Budget defaults (tunable)

| Key | Value (initial) | Notes |
|-----|-------------------|--------|
| `maxClientChunkKbWarning` | 350 | Largest raw chunk |
| `maxClientChunkKbError` | 500 | `PERF_BUDGET_STRICT=1` fails at or above |
| `maxFirstLoadKbWarning` | 380 | Heuristic sum of framework-ish chunks (conservative) |
| `maxFirstLoadKbError` | 500 | Strict failure threshold |
| `maxUseClientLinesWarning` | 300 | Line count |
| `maxUseClientLinesError` | 600 | Strict use-client audit |

Adjust `performance-budget.config.json` as the codebase shrinks or after intentional baseline captures.

## Strict-mode behavior

| Env | Effect |
|-----|--------|
| `PERF_BUDGET_STRICT=1` | `check-bundle-budget.mjs` exits **1** if **error** thresholds exceeded |
| `USE_CLIENT_AUDIT_STRICT=1` | Exits **1** if any client file ≥ `maxUseClientLinesError` lines |
| `HEAVY_IMPORT_AUDIT_STRICT=1` | Exits **1** if a heavy import is **not** covered by `heavyImportAllowlist` |
| `npm run perf:audit:strict` | Sets all three for one run |

**Note:** `USE_CLIENT_AUDIT_STRICT=1` currently fails on many legacy large portal files (multi‑thousand-line `"use client"` modules). Use strict selectively until those boundaries are split; default **`perf:audit` stays warning-only (exit 0)**.

## Known warnings (current codebase snapshot)

- **`audit-use-client`**: ~329 `"use client"` files; dozens exceed 600 lines (SIZE ERROR labels are informational unless strict mode is on).
- **`audit-heavy-imports`**: Typically reports **`recharts`** from `components/portal/ad/ad-coaches-pie-chart-card.tsx` (allowlisted). Server `app/api/**` imports are **skipped** to avoid noise.
- **`check-bundle-budget`**: After build, largest chunk ~336 KB raw (within chunk warning); first-load heuristic ~344 KB — tuned so warning thresholds align with **post-build** reality (re-run after major dependency changes).

## How PRs should use this

1. For non-trivial UI: `npm run typecheck`, `npm run build`, `npm run perf:audit`.
2. For large bundles or new deps: `npm run analyze` and/or `npm run perf:bundle`.
3. Answer the **Performance checklist** in the PR template.
4. Optionally enable strict modes locally when touching boundaries or imports:  
   `cross-env HEAVY_IMPORT_AUDIT_STRICT=1 node scripts/audit-heavy-client-imports.mjs`

## CI

`Deploy Guard` runs **`npm run perf:audit`** after **`npm run build`**. It does **not** run `perf:audit:strict` by default, so legacy size issues do not block merges.

## Validation (Phase 8)

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `node scripts/audit-use-client.mjs` | Pass (exit 0) |
| `node scripts/audit-heavy-client-imports.mjs` | Pass (exit 0) |
| `npm run build` | Pass |
| `node scripts/check-bundle-budget.mjs` | Pass (exit 0; thresholds within policy after tuning) |
| `npm run perf:audit` | Pass (exit 0) |

*(Timestamp: run locally during Phase 8 implementation.)*
