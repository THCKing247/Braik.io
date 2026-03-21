# Phase 6 — Release smoke checklist (manual)

Run after deploy or before a release candidate. Check each flow in a **clean browser session** where possible.

## Auth & onboarding

- [ ] **Head coach signup** → account created, lands with a team context.
- [ ] **Onboarding wizard** (`/onboarding`) completes once; **second submit** returns a clear “already has a program” message with path to dashboard (409).
- [ ] **Non–head-coach** cannot complete POST `/api/onboarding` (403).
- [ ] **Player** signup with valid code joins correct team; invalid code shows a clear error.
- [ ] **Parent** signup with valid player/parent code links once; **duplicate link** returns 409 with a sign-in message.

## Org / team / program

- [ ] Dashboard shows the expected **primary team** after onboarding.
- [ ] **JV / Freshman** teams appear when selected in onboarding (program has multiple teams).

## Roster & billing

- [ ] Add player until limit (if caps configured) → **402** with roster limit message; no silent overage.
- [ ] If roster count query fails, UI or API surfaces a **retry / support** style message (not unlimited adds).

## Injuries

- [ ] Create injury for a player on the team → success.
- [ ] Attempt injury with **wrong `playerId` for `teamId`** → 400 with clear copy.
- [ ] Resolve injury → disappears from active list; PATCH unknown id → **404**.

## Messaging & announcements

- [ ] Coach can open messaging; **empty state** explains next steps.
- [ ] Thread creation respects permissions (parent/player boundaries); blocked cases return a clear API error.

## Support

- [ ] `/dashboard/support` loads; mailto and policy links work.

## Regression spot-checks

- [ ] Playbooks: open list, open one playbook (view path).
- [ ] Stats page loads without a blank crash for a new team.
- [ ] Attendance / docs: open pages used in production; no unhandled error boundary.

---

**Automated (local):** `npx tsx tests/messaging-thread-validation.test.ts`
