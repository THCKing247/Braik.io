# Production observability checklist

Run after **every production deploy** (or when investigating regressions). No secrets below — use dashboards with authenticated access.

## Fast checks (5–10 min)

- [ ] **Netlify deploy** — latest production deploy **Published**; note build duration vs usual.
- [ ] **Site responds** — homepage and `/login` load without 5xx.
- [ ] **Auth** — log in with a test account; session cookie present (`sb-access-token` pattern).
- [ ] **Dashboard** — `/dashboard` loads; team shell renders.
- [ ] **Web Vitals (spot)** — Chrome Lighthouse or field data (if available): no new CLS spikes on dashboard home.

## Supabase (dashboard)

- [ ] **Project status** — no outage banner.
- [ ] **Database → Advisors** — review **Performance** / **Security** hints (informational; schedule follow-ups).
- [ ] **Logs** — scan **API**, **Postgres**, **Auth**, **Realtime**, **Storage** for error bursts in last 1–24h.
- [ ] **Auth** — unusual spike in failed logins / rate limits (possible attack or misconfiguration).

## Application signals

- [ ] **Messaging** — open a thread; send a message; no 500 on `/api/messages/*`.
- [ ] **Notifications** — unread badge updates or notification path works for a test user.
- [ ] **Coach B** — open assistant; one prompt returns (OpenAI configured).
- [ ] **Mobile** — narrow viewport: tab bar + More sheet + messages list/detail (Phase 7 surfaces).

## Performance regression response

1. Confirm deploy scope (what shipped).
2. Compare **Netlify build times** and **function logs** for slow routes.
3. Run **`npm run perf:audit`** locally after **`npm run build`** (Phase 8 bundle budget).
4. For DB regressions: follow `PHASE_5_DATABASE_PERFORMANCE_REPORT.md` / readonly diagnostics.
5. For media: follow `PHASE_6_MEDIA_PERFORMANCE_REPORT.md`.

## Rollback

1. **Netlify** — Deploys → select last known-good deploy → **Publish deploy**.
2. **Git** — revert offending commit and redeploy if rollback deploy is insufficient.
3. Document incident: deploy ID, time range, suspected change.

See **`PHASE_9_DEPLOYMENT_OBSERVABILITY_REPORT.md`** for environment variables, caching policy, and logging flags.
