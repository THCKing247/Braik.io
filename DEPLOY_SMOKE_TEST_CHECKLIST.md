# Deploy smoke test checklist

Practical manual pass after production deploys (or before announcing a release). Adjust order for your role (coach vs player).

## Environment

- [ ] Production URL (not deploy-preview unless testing previews).
- [ ] Clear cookies or use incognito for “cold” login test when needed.

## Flows

- [ ] **Homepage** loads; marketing navigation works.
- [ ] **Login** — credentials succeed; redirect to dashboard or intended destination.
- [ ] **Dashboard load** — shell, team context, no persistent error banner.
- [ ] **Sidebar / route transition** (desktop) — navigate to a secondary route (e.g. roster or calendar).
- [ ] **Mobile nav** — tab bar + **More** sheet open; navigate to one secondary route.
- [ ] **Messaging** — open Messages; thread list loads; open a thread.
- [ ] **Send message** — message appears in thread (and no 500 in network tab).
- [ ] **Attachment** — open an image/file message if available in test thread.
- [ ] **Notifications** — unread badge or notification surface reflects state after an action (if applicable).
- [ ] **Coach B** — open assistant; send one short prompt; response returns.
- [ ] **Logout** — session cleared; protected routes redirect to login.

## If something fails

Capture: **URL**, **time (UTC)**, **user role**, **browser**, **screenshot / HAR** (no passwords). Check Netlify function logs and Supabase API logs for the same window.

See **`PRODUCTION_OBSERVABILITY_CHECKLIST.md`** for broader monitoring steps.
