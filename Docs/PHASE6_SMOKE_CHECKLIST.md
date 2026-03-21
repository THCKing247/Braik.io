# Phase 6 — Release smoke checklist (developer)

Run after deploy or before a release candidate. Mark pass/fail; capture notes for failures.

## Auth & session

- [ ] Sign up (head coach path) completes; session cookie present for `/dashboard`.
- [ ] Login returns to intended `callbackUrl` when provided.
- [ ] Middleware: unauthenticated visit to `/dashboard/*` redirects to `/login`.

## Onboarding & org structure

- [ ] Head coach onboarding creates program + varsity team; profile `team_id` matches primary team.
- [ ] Second onboarding attempt returns clear error (`ALREADY_ONBOARDED` / 409), no duplicate program.
- [ ] JV / Freshman levels create additional teams under same program when selected.

## Roster & billing caps

- [ ] Add player respects duplicate rules (name/email/jersey).
- [ ] With a positive `roster_slot_limit`, adding past limit returns `ROSTER_LIMIT_REACHED` (402) with message.
- [ ] Roster import batch respects same cap.

## Player / parent linking

- [ ] Guardian API returns 403 for wrong user (not coach, not self).
- [ ] Join / invite redeem flows still link player to roster row (spot-check one path).

## Injuries

- [ ] List injuries requires coach (`edit_roster`); 403 for player-only if applicable.
- [ ] Create injury rejects `playerId` not on `teamId` (400).
- [ ] Resolve / patch injury scoped to `team_id`.

## Playbooks & stats

- [ ] `GET /api/playbooks?teamId=` requires team membership.
- [ ] `GET /api/stats?teamId=` requires team membership.

## Messaging & announcements

- [ ] **Thread create:** player cannot create thread (403 + `THREAD_CREATE_DENIED`).
- [ ] **Thread create:** thread with only parent + player (no coach) rejected (`INVALID_THREAD_COMPOSITION`).
- [ ] **Thread create:** non-team user in participant list rejected (`PARTICIPANT_NOT_ON_TEAM`).
- [ ] Team announcements: `POST /api/teams/[teamId]/team-announcements` requires `post_announcements`.
- [ ] Legacy `POST /api/announcements` remains 501 — no client should call it.

## Coach B / AI (if enabled)

- [ ] Coach-only surfaces; player/parent blocked on server for sensitive routes.

## Support & settings

- [ ] Support page loads for authenticated coach; ticket API errors surface a message (no silent fail).

## Admin

- [ ] Admin login isolated from portal; impersonation audit if used.

## Notes

- Billing lifecycle enforcement flag: see `isBillingLifecycleEnforced()` in `lib/billing/billing-state.ts` (`BILLING_ENFORCED`).
- Attendance: no dedicated `attendance` module found; validate **schedule / calendar events** flows instead.
