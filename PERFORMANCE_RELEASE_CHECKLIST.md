# Performance release checklist

Use before tagging a **production** release (after Phases 0–10). Adapt for hotfixes.

## 1. Required commands (automated)

Run locally or confirm CI passed:

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run perf:audit` (after build; includes bundle budget when `.next` exists)

Optional before major UI releases:

- [ ] `npm run analyze` (bundle analyzer; second full build)

## 2. Required manual QA flows

- [ ] **`DEPLOY_SMOKE_TEST_CHECKLIST.md`** — core user journeys (home, login, dashboard, messages, Coach B, mobile nav, logout).
- [ ] **Portal spot-check** — at least one coach-context and one player/parent-context path if applicable.
- [ ] **Messaging** — thread open, send, attachment open (image + non-image if available).
- [ ] **Mobile viewport** — tab bar, More sheet, messages list/detail back navigation.

## 3. Required production / infra checks

- [ ] **`PRODUCTION_OBSERVABILITY_CHECKLIST.md`** — Netlify deploy green; Supabase logs scan for spikes.
- [ ] Environment: **no** `BRAIK_API_DEBUG`, **no** `NEXT_PUBLIC_BRAIK_PERF`, **no** verbose perf flags in production unless actively diagnosing (unset after).

## 4. Metrics to capture (baseline optional)

| Metric | Where |
|--------|--------|
| First Load JS (home, dashboard, messages) | `next build` output |
| Largest chunk KB | `npm run perf:bundle` |
| Deploy duration | Netlify deploy detail |

Store in PR or internal doc if comparing releases.

## 5. Rollback plan

1. Netlify: **Publish** previous production deploy.
2. Git: revert release commit and redeploy if needed.
3. Record incident notes (deploy ID, window, suspected change).

See **`PHASE_9_DEPLOYMENT_OBSERVABILITY_REPORT.md`**.

## 6. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | Commands + code review |
| QA / Product | | | Manual smoke complete |

**Release blocker criteria (examples):**

- `typecheck` or `build` fails.
- P0 security or data-loss bug open.
- Authentication or messaging completely broken on staging.
- Supabase or Netlify showing sustained outage / error storm for the release candidate.

**Not automatically blockers:** P2 bundle size warnings, legacy large client files, optional `perf:audit:strict` failures without policy to enforce strict mode.

## 7. Related docs

- `PHASE_10_RELEASE_READINESS_REPORT.md`
- `PERFORMANCE_FOLLOW_UPS.md`
- `DEPLOY_SMOKE_TEST_CHECKLIST.md`
- `PRODUCTION_OBSERVABILITY_CHECKLIST.md`
- `PERFORMANCE_GUIDELINES.md`
