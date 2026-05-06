#!/usr/bin/env node
/** Phase 9 — print pointers to deploy / observability docs (no secrets). */
console.log(`
Braik production checklists (repo root):

  PRODUCTION_OBSERVABILITY_CHECKLIST.md   — post-deploy monitoring
  DEPLOY_SMOKE_TEST_CHECKLIST.md          — manual smoke tests

Related:

  PHASE_9_DEPLOYMENT_OBSERVABILITY_REPORT.md
  PERFORMANCE_REGRESSION_CHECKLIST.md

Optional env for production API troubleshooting (server-only):

  BRAIK_API_DEBUG=1   — verbose API traces (see lib/debug/braik-api-debug.ts)
`)
