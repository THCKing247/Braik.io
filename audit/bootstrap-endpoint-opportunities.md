# Bootstrap endpoint opportunities

**Audit date:** 2026-06-02  
**Note:** Existing dashboard staged bootstrap is **protected** — opportunities below are additive elsewhere, not merges of `bootstrap-light` / `deferred-core` / `deferred-heavy`.

---

## 1. `/api/messages/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | `GET /api/dashboard/bootstrap-deferred-core` (partial inbox), `useMessagesThreadsQuery` → threads list API, `useMessagingUnreadTotalQuery` → Supabase RPC, `useMessageThreadInboxStatsQuery` → Supabase RPC, `loadContacts` → contacts API, optional `GET /api/messages/thread/:id` on deep link |
| **First-screen data** | Thread list (wire format), total unread, inbox stats for visible threads, messaging permissions snapshot, contacts list (or lazy-load contacts in phase 2) |
| **Defer** | Full message bodies, attachment binaries, older pagination (`before`), Realtime channel setup |
| **Risk** | Medium — must preserve permission filtering and thread validation rules from `lib/enforcement/messaging-permissions.ts` |
| **Order** | **2** (after parent portal bootstrap; high user traffic) |

---

## 2. `/api/parent-portal/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | `GET /api/dashboard/shell`, `GET /api/parent/portal-context?linkCode=`, `useDashboardBootstrapQuery` (announcements), per-page: documents (2 fetches), notifications, calendar games |
| **First-screen data** | Parent user id, linked player ids/segments, team id/name/sport, announcement rows for home feed, optional unread counts |
| **Defer** | Full document lists, calendar full range, messages inbox (until Messages tab) |
| **Risk** | Medium — parent-child linkage and RLS must match `portal-context` route |
| **Order** | **1** (hard gate today; clearest waterfall to remove) |

---

## 3. `/api/player-portal/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | `GET /api/dashboard/shell`, `GET /api/roster/me?teamId=`, `bootstrap-light` + `deferred-core`, `GET .../highlight-posts` on home |
| **First-screen data** | `playerId`, account segment, team hero fields, announcement posts, highlight posts (or first page), film hub nav flags |
| **Defer** | Study assignments, playbook lists, full calendar range, quiz content |
| **Risk** | Medium — player portal uses same shell as coach; must not leak coach-only bootstrap slices |
| **Order** | **3** |

---

## 4. `/api/roster/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | Dashboard bootstrap roster slice + `kickDeferredCoreMerge` + on-tab `/api/teams/:id/readiness` (×2 shapes), `/api/roster/depth-chart`, activity, follow-ups |
| **First-screen data** | Player rows for card/list, position labels, summary readiness flags (if on default tab) |
| **Defer** | Full depth chart payload, program-depth chart, activity history, follow-ups list |
| **Risk** | Medium–high — depth chart already in `bootstrap-deferred-heavy`; avoid duplicating protected heavy merge |
| **Order** | **4** — prefer extending **deferred-core/heavy** for roster page-specific flags rather than a competing monolith |

---

## 5. `/api/settings/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | Layout shell (if from dashboard) + `GET /api/me/settings-page-bundle` |
| **First-screen data** | Same as existing bundle (profile, team, calendar settings, player count, onboarding flag) |
| **Defer** | N/A — page is settings-only |
| **Risk** | Low — bundle already exists; rename/widen cache headers only |
| **Order** | **5** — lowest ROI; bundle is already consolidated |

---

## 6. `/api/documents/bootstrap` (proposed)

| Field | Detail |
|-------|--------|
| **Current separate calls** | Shell + `GET /api/documents?teamId=` on mount |
| **First-screen data** | Document list metadata (no signed URLs until open) |
| **Defer** | Signed URL generation, share links |
| **Risk** | Low |
| **Order** | **6** |

---

## 7. `/api/game-video/bootstrap` (proposed — list only)

| Field | Detail |
|-------|--------|
| **Current separate calls** | Bootstrap `videoClips` entitlements + `GET game-videos` + N × `GET .../clips` |
| **First-screen data** | Entitlements + video index (id, title, thumb, clip counts) in **one** query |
| **Defer** | Per-clip bodies, preview strips, upload multipart |
| **Risk** | Medium — large payloads; do not change film business logic, only aggregation |
| **Order** | **1b** (tie with game-video perf — highest $ impact) |

*Alternative:* extend `AppBootstrapPayload.videoClips` with a capped video index for first paint (no new route).

---

## 8. `/api/schedule/bootstrap` (proposed — optional)

| Field | Detail |
|-------|--------|
| **Current separate calls** | `fetchTeamGamesForRange` + bootstrap game slices |
| **First-screen data** | Games for schedule page window (already computed in `getSchedulePageGamesRange`) |
| **Defer** | Import templates, AI recap, per-game panel stats |
| **Risk** | Low if aligned with bootstrap game windows |
| **Order** | **7** — defer until bootstrap game overlap is measured |

---

## Protected: do not merge

- `/api/dashboard/bootstrap-light`
- `/api/dashboard/bootstrap-deferred-core`
- `/api/dashboard/bootstrap-deferred-heavy`
- `lib/dashboard/dashboard-bootstrap-query.ts`
- `app/providers.tsx`

**Allowed:** New endpoints that **read** the same builders/cache keys these routes use, or portal-specific bootstraps that **call** shared lib functions without changing staged response shapes.

---

## Recommended implementation order (summary)

1. **Parent portal bootstrap** — removes strict serial gate (`portal-context` after shell).  
2. **Game video list bootstrap** (or bootstrap payload extension) — removes N+1.  
3. **Messages bootstrap** — collapses HTTP + RPC round-trips for inbox.  
4. **Player portal bootstrap** — merges `roster/me` + home feed prerequisites.  
5. **Roster tab bootstrap** — extend deferred-heavy/core, not new monolith.  
6. **Settings** — optional cache tuning only.  
7. **Schedule** — only if metrics show duplicate game fetches.
