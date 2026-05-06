# Performance follow-ups (post Phase 10)

Grouped by severity. Replace **Owner** with a person or team.

---

## P0 — Release blockers

*None from automated Phase 10 validation. Add items here if smoke tests find regressions.*

| Title | Area | Symptom | Likely cause | Recommended fix | Owner | Validation |
|-------|------|---------|--------------|-----------------|-------|--------------|
| *(placeholder)* | — | — | — | — | — | — |

---

## P1 — High impact (should fix soon)

| Title | Area | Symptom | Likely cause | Recommended fix | Owner | Validation |
|-------|------|---------|--------------|-----------------|-------|--------------|
| Complete production smoke | Release | Unknown UX regressions | Automated tests don’t cover all journeys | Run `DEPLOY_SMOKE_TEST_CHECKLIST.md` + `PERFORMANCE_RELEASE_CHECKLIST.md` on staging/prod | TBD | Manual |
| Supabase advisor sweep | Database | Slow queries in prod | Missing indexes / N+1 | Run Performance advisor + `PHASE_5` diagnostics | TBD | Dashboard + SQL |
| Netlify deploy parity | Deploy | Build works locally but fails CI | Env / Node drift | Align secrets & `NODE_VERSION`; review deploy logs | TBD | CI + Netlify |

---

## P2 — Improvements / future optimization

| Title | Area | Symptom | Likely cause | Recommended fix | Owner | Validation |
|-------|------|---------|--------------|-----------------|-------|--------------|
| Web Vitals (LCP/INP) reporting | Instrumentation | Task asked for `web_vitals.lcp`; not in codebase | Never wired | Add `reportWebVitals` in `app/layout` client boundary + optional `NEXT_PUBLIC_BRAIK_PERF` tee to analytics | TBD | Console / RUM |
| Unified route transition event names | Debugging | Mixed `[braik-nav-perf]` strings vs `route_transition.*` schema | Incremental phases | Optional adapter logging same shape as internal perf spec | TBD | DevTools |
| Reduce mega client files | Bundle | Many `"use client"` files >600 lines | Historical architecture | Split modules incrementally (not Phase 10 scope) | TBD | `perf:audit:strict` |
| Calendar events route verbose logs | API | Many code paths | Already gated `braikApiDebug` in `/api/events`; extend pattern to other hot routes | Incremental `braikApiDebug` migration | TBD | Prod logs volume |
