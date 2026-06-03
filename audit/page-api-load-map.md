# Page / API load map

**Audit date:** 2026-06-02  
**Purpose:** First-load and initial-hydration data paths for major portal areas. **Read-only audit.**

## Shared infrastructure (all coach dashboard team routes)

| Layer | Entry | Initial network |
|-------|--------|-----------------|
| Root providers | `app/providers.tsx` | React Query defaults; `SessionProvider` → session query; deferred native/route trackers |
| Team layout | `app/(portal)/dashboard/(team)/layout.tsx` → `DashboardTeamShellGate` | **1×** `GET /api/dashboard/shell` (`useDashboardShellQuery`, 10 min stale) |
| Team chrome | `DashboardLayoutClient` + `AppBootstrapProvider` (when `currentTeamId` set) | **Staged bootstrap** (see protected dashboard section) |
| Identity | `useDashboardShellIdentity` | Prefers shell/bootstrap over waiting on full session |

**Waterfall (coach team portal):** Shell → (team resolved) → bootstrap-light → deferred-core → optional deferred-heavy. Pages should not re-fetch shell fields ad hoc.

---

## Dashboard (home)

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/page.tsx` |
| **UI** | `TeamDashboard` via `DashboardPageShell` |
| **Initial APIs** | Inherited: `/api/dashboard/shell`; per-team `bootstrap-light` (+ deferred when `DashboardHomeDeferredBootstrapTrigger` / `kickDeferredCoreMerge`) |
| **Extra client fetch** | AD role: `GET /api/routing/organization-default` (redirect only) |
| **React Query** | `useDashboardBootstrapQuery(teamId)` inside `AppBootstrapProvider` / `TeamDashboard` |
| **Direct Supabase (client)** | None on home |
| **Duplicates** | `NotificationsWidget` may `GET /api/notifications?preview=1` if not seeded from deferred-core (noted in code TODO) |
| **Heavy before paint** | Light bootstrap only; games/calendar/readiness filled in deferred phases |
| **Load impact** | **Medium** — staged design limits first paint; deferred-core still adds 1 round-trip after light |

---

## Messages

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/messages/page.tsx` → `DashboardTeamMessagesPage` |
| **UI** | `MessagingManager` |
| **Initial APIs** | Shell + bootstrap; threads inbox from **deferred-core** when `bootstrapCoreReady` |
| **React Query** | `useMessagesThreadsQuery` (enabled when bootstrap inbox not used); `useMessagingUnreadTotalQuery`; `useMessageThreadInboxStatsQuery` |
| **Client Supabase** | `supabase.rpc` for unread total + inbox stats; Realtime subscription on open thread |
| **useEffect fetches** | `loadContacts()` → `fetchMessagesContacts` / contacts API; thread open → `GET /api/messages/thread/:id` |
| **Waterfalls** | Shell → bootstrap-light → deferred-core (inbox) → parallel: threads list + RPC unread + contacts; selecting thread adds detail fetch |
| **Heavy before paint** | Thread list/metadata can wait on deferred-core; opening thread loads up to 40 messages + attachment metadata |
| **Load impact** | **High** — multiple parallel channels (HTTP + RPC + Realtime); duplicate thread/unread sources if bootstrap and queries both run |

**Free portal:** `player/.../messages`, `parent/.../messages` — same `MessagingManager` with portal context; parent/player shells add portal-specific gates below.

---

## Roster

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/roster/page.tsx` |
| **UI** | `RosterManagerEnhanced` |
| **Initial APIs** | Shell; `useDashboardBootstrapQuery` for player list from bootstrap; `kickDeferredCoreMerge` if `deferredPending` |
| **On tab / interaction** | `/api/teams/:id/readiness` (multiple query shapes), `/api/roster/depth-chart`, `/api/teams/:id/activity`, `/api/teams/:id/follow-ups`, `/api/programs/:id/teams`, full `/api/roster` refresh after mutations |
| **React Query** | Bootstrap query; not all roster tabs use RQ for readiness |
| **Waterfalls** | Bootstrap light (roster may be partial) → deferred-core for full roster/depth → tab switches trigger more fetches |
| **Heavy before paint** | Card/list view uses bootstrap roster when merged; depth chart in **deferred-heavy** |
| **Load impact** | **High** on depth/readiness tabs; **Medium** on default roster tab |

---

## Schedule

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/schedule/page.tsx` |
| **UI** | `TeamScheduleContent` + dynamic game views |
| **Initial APIs** | Shell; `useQuery` → `fetchTeamGamesForRange` → team games API for computed ISO range |
| **Bootstrap overlap** | Comments prefer `bootstrap.payload.team.name`; games may also exist in bootstrap windows |
| **Waterfalls** | Shell → bootstrap (optional) ∥ games query when `teamId` known |
| **Heavy before paint** | Full season-range games in one query (by design, one round-trip per mount) |
| **Load impact** | **Medium** — single dedicated games fetch; possible overlap with bootstrap calendar/games slices |

---

## Settings

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/settings/page.tsx` → `SettingsPageClient` |
| **Initial APIs** | **1×** `GET /api/me/settings-page-bundle` (React Query, 60s stale) |
| **Shell** | Still pays shell cost from layout if navigated from dashboard |
| **Waterfalls** | Shell (layout) then settings bundle on page mount — **independent** of team bootstrap |
| **Heavy before paint** | Entire bundle (profile, team, calendar settings, players count) in one response |
| **Load impact** | **Medium** — isolated bundle but does not reuse dashboard bootstrap |

---

## Documents

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/documents/page.tsx` |
| **Initial APIs** | Shell; **1×** `GET /api/documents?teamId=` in `useEffect` (no React Query) |
| **Client Supabase** | None |
| **Waterfalls** | Shell → documents list fetch on mount |
| **Heavy before paint** | Full document list + creator/ack metadata server-side |
| **Load impact** | **Medium** — simple but not integrated with bootstrap cache |

---

## Film / game video (dashboard)

| Item | Detail |
|------|--------|
| **Page** | `app/(portal)/dashboard/(team)/game-video/page.tsx` (also `film/page.tsx` may redirect — not modified in audit) |
| **UI** | `GameVideoLibrary` |
| **Initial APIs** | Shell; entitlements from `AppBootstrapProvider.payload.videoClips`; `GET /api/teams/:teamId/game-videos` then **per-video** `.../clips` |
| **Waterfalls** | Shell → bootstrap (entitlements) → videos list → N clip fetches |
| **Heavy before paint** | All videos + all clip lists can load before interaction |
| **Load impact** | **Very high** — classic N+1; largest regression risk in portal |

*Player prep film hub (`/player/.../prep/film`) not deep-dived per scope (do not modify film logic); likely separate components under Film hub layout.*

---

## Player portal

| Item | Detail |
|------|--------|
| **Layout** | `app/(free-portal)/player/[accountId]/layout.tsx` → `PlayerPortalShellGate` |
| **Shell** | Same `GET /api/dashboard/shell` (player `portalKind`) |
| **Context** | `PlayerPortalProvider`: **1×** `GET /api/roster/me?teamId=` for `playerId` |
| **Home** | `player-portal-home.tsx`: `useDashboardBootstrapQuery` + `kickDeferredCoreMerge`; **1×** `GET .../highlight-posts` |
| **Other tabs** | Calendar/messages/study/playbooks reuse bootstrap + feature APIs (grep: bootstrap query on announcements, calendar, messages, study, playbooks) |
| **Waterfalls** | Shell → portal provider (`roster/me`) → bootstrap-light → deferred-core → highlight-posts |
| **Load impact** | **High** on home — 4+ sequential/parallel gates before feed is complete |

---

## Parent portal

| Item | Detail |
|------|--------|
| **Layout** | `app/(free-portal)/parent/[linkCode]/layout.tsx` → `ParentPortalShellGate` |
| **Shell** | `GET /api/dashboard/shell` (parent `portalKind`) |
| **Context** | `ParentPortalProvider`: **1×** `GET /api/parent/portal-context?linkCode=` **before** children render |
| **Home** | `useDashboardBootstrapQuery` for announcements only (static placeholder posts otherwise) |
| **Subpages** | Documents: parallel `player-documents` + `documents`; Messages: `MessagingManager`; Calendar: team games/calendar patterns; Reminders: notifications preview |
| **Waterfalls** | Shell → **portal-context** (blocks UI) → bootstrap for team-scoped data |
| **Load impact** | **High** — portal-context is a hard gate; bootstrap duplicates shell team resolution |

---

## Protected dashboard bootstrap (do not simplify)

| Endpoint / module | Role |
|-------------------|------|
| `GET /api/dashboard/bootstrap-light` | First paint team header, stub games/calendar |
| `GET /api/dashboard/bootstrap-deferred-core` | Roster, inbox, notifications, announcements, etc. |
| `GET /api/dashboard/bootstrap-deferred-heavy` | Depth chart |
| `lib/dashboard/dashboard-bootstrap-query.ts` | Staging, merge, inflight dedupe |
| `app/providers.tsx` | Query client stale defaults |

Legacy `GET /api/dashboard/bootstrap` exists; staged endpoints are preferred per route comments.

---

## Top duplicate / repeated data patterns

1. **Team/user/session:** `dashboard/shell` + bootstrap-light + `client-auth` session query (mitigated by `seedAuthSessionCacheFromShellUser`).
2. **Messaging unread:** bootstrap shell unread + `messaging_unread_total` RPC + notifications preview.
3. **Games:** bootstrap windows vs schedule page `teamGamesQuery`.
4. **Roster:** bootstrap roster vs `/api/roster` refresh after edits.
5. **Parent:** shell team id + `portal-context` full payload.

---

## Slowest / highest-risk pages (summary)

| Rank | Area | Primary reason |
|------|------|----------------|
| 1 | Game video library | N+1 clip fetches |
| 2 | Messages | HTTP + Supabase RPC + Realtime + contacts |
| 3 | Roster (depth/readiness) | Extra readiness/depth endpoints beyond bootstrap |
| 4 | Player portal home | shell + roster/me + bootstrap + highlights |
| 5 | Parent portal entry | shell + portal-context waterfall |
