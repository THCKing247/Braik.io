# Dashboard data ownership

This document defines **which API owns which slice** of coach/team dashboard data so new work does not add duplicate client fetches or loading waterfalls on top of the existing shell + staged bootstrap architecture.

**Execution path (client):**

1. `GET /api/dashboard/shell` — first paint gate for chrome (React Query in `dashboard-team-shell-gate.tsx`).
2. `GET /api/dashboard/bootstrap-light` — team-scoped bootstrap query seeds `AppBootstrapProvider` / `["dashboard-bootstrap", teamId]`.
3. After visibility / scheduling (`kickDeferredCoreMerge`, `kickDeferredHeavyMerge` in `lib/dashboard/dashboard-bootstrap-query.ts`), deferred endpoints merge into the same React Query cache.

**Legacy / refresh:** `GET /api/dashboard/bootstrap` remains a single round-trip option for tooling or callers that still use it; splitting ownership below applies equally (same builders under the hood).

---

## `GET /api/dashboard/shell`

**Owns (authoritative for):**

- Authenticated user identity for layout (lite JWT → `SessionUser`): id, email, role, `teamId`, `isPlatformOwner`, **resolved** `defaultAppPath` / portal routing hints.
- **Team switcher**: full team list the user may access, resolved `currentTeamId`, optional dashboard team hint cookie for AD.
- **Portal metadata**: `portalKind`, `playerAccountSegment`, `parentPortalSegment` where applicable.
- **Subscription placeholders** surfaced in shell (`subscriptionPaid`, `remainingBalance`) — not bootstrap.
- **Impersonation** session for support flows.
- AD-delegate mode (`shellMode: "ad-delegate"`) with minimal payload.

**Does not own:**

- Per-team capability flags (`canEditRoster`, Coach B+, video entitlements) — those live in **bootstrap `shell`** (`AppBootstrapPayload`).
- Games, calendar rows, roster, depth chart, announcements list, notification rows, readiness — **bootstrap** slices only.

**Client rule:** Prefer `useDashboardShellQuery` / shell payload for teams + current team + portal routing. Do not refetch “my teams” from another endpoint when shell succeeded.

---

## `GET /api/dashboard/bootstrap-light`

**Owns (authoritative for):**

- **`shell`**: `AppBootstrapPayload` — user + team summary for header, **team capability flags**, Coach B+, **unread notification count** (scalar), video/clips gating, engagement placeholder (counts filled after deferred-core merge).
- **`dashboard`**: **minimal home slice** — team header row (name, logo, sport, season…); **empty** `games` / `calendarEvents`; readiness **skipped** or stub per builder.
- **`roster`**: empty array (placeholder until deferred-core).
- **`notifications`**: shape present; preview rows often empty until core merges.
- **`announcements`**: empty until core merges (or minimal — trust server builder).
- **`deferredPending: true`** — signals client to merge deferred-core when ready.
- **`deferredHeavyPending: true`** — depth chart not merged yet.
- **`depthChart`**: empty entries until heavy merge.
- **`generatedAt`** timestamp.

**Does not own:**

- Full games list, calendar events, full roster, depth chart entries, coach engagement counts (those arrive in deferred payloads).

**Client rule:** First paint should not assume games/calendar/roster are populated. Widgets must tolerate `deferredPending` or read merged cache after core/heavy.

---

## `GET /api/dashboard/bootstrap-deferred-core`

**Owns (authoritative for):**

- **`dashboard`**: full home slice — **games**, **calendarEvents** (home grid fields), **readiness summary** (or skipped for roles where not applicable).
- **`roster`**: roster list for dashboard consumers.
- **`notifications`**: preview list + unread alignment with notification APIs.
- **`announcements`**: team announcements rows for dashboard surfaces.
- **`readinessDetail`**: coach-facing detail when included (heavy paths may still defer to roster APIs).
- **`messageThreadsInbox`**: messaging inbox snapshot when enabled.
- **`engagementHintCounts`**: merged onto shell engagement for hints UI (same source as `GET /api/engagement/hints` counts path).
- Empty **`playbooksSummary`** / **`teamDocumentsList`** placeholders — browse routes own real lists.

**Does not own:**

- Depth chart positions (**deferred-heavy**).
- Full playbooks/documents browse payloads — **route-specific** (`/api/playbooks/summary`, `/api/documents`, etc.).

**Client rule:** After merge, home dashboard widgets should use this data from React Query / `AppBootstrapProvider` instead of parallel `GET /api/teams/...` for the same fields, unless mutating or refreshing after an explicit change event.

---

## `GET /api/dashboard/bootstrap-deferred-heavy`

**Owns (authoritative for):**

- **`depthChart.entries`** only (+ `generatedAt`).

**Does not own:**

- Anything in core slice; roster page may still load richer depth interactions via roster routes.

**Client rule:** Depth chart tab/widgets should use merged bootstrap after heavy; avoid a duplicate depth fetch on initial dashboard load when `deferredHeavyPending` becomes false.

---

## Route-specific fetches (not duplicated by bootstrap)

These remain **separate endpoints** by design; bootstrap holds **empty placeholders** or summaries only:

| Area | Endpoint(s) | Notes |
|------|-------------|--------|
| Playbooks browse | `GET /api/playbooks/summary` | Bootstrap `playbooksSummary` is `[]`. |
| Team documents browse | `GET /api/documents` | Bootstrap list is `[]`. |
| Per-player readiness drill-in | `GET /api/teams/:id/readiness` variants | Bootstrap may carry summary/detail flags; full grids use roster routes. |
| Calendar **mutations** / external sync | Calendar APIs | After changes, invalidate bootstrap or listen for `BRAIK_CALENDAR_EVENTS_CHANGED_EVENT`. |
| Messaging send / thread detail | Messages APIs | Inbox snapshot may exist on bootstrap; conversations are route-owned. |
| Settings, inventory, fundraising, film | Respective `/api/teams/...` routes | Feature surfaces — not part of global bootstrap. |

**Rule:** If a feature is **only** used on a dedicated sub-route, default to **route-local** fetching. If it appears **above the fold on dashboard home**, prefer extending the correct bootstrap phase over a new always-on parallel request.

---

## Phase 4 cleanup (TODOs in code)

Tracked in components where bootstrap/shell already provide the same data but a secondary fetch still runs in some paths (e.g. header widget + home card, or fallback when counts are null). See `TODO(Phase 4)` comments in:

- `components/portal/notifications-widget.tsx`
- `components/portal/team-dashboard.tsx` (`NotificationsCard`)
- `components/portal/dashboard-announcements-card.tsx`
- `components/portal/dashboard-calendar.tsx`
- `components/portal/dashboard-engagement-hints.tsx`
- `components/portal/readiness-summary-card.tsx`

- `components/portal/roster-manager-enhanced.tsx` (readiness bundle vs `prefetchedReadinessDetail`)

---

## Related files

| File | Role |
|------|------|
| `lib/dashboard/dashboard-shell-payload.ts` | Shell JSON shape |
| `lib/app/app-bootstrap-types.ts` | `AppBootstrapPayload` (embedded in bootstrap `shell`) |
| `lib/dashboard/dashboard-bootstrap-types.ts` | Bootstrap and deferred payload shapes |
| `lib/dashboard/dashboard-bootstrap-query.ts` | React Query keys, light + deferred merge orchestration |
| `lib/dashboard/merge-dashboard-bootstrap.ts` | Client-side merge rules |
| `PERFORMANCE_GUIDELINES.md` | First-render and fetching guardrails |
