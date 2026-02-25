# Deploy Verification Checklist (GitHub -> Netlify)

Use this checklist before and after every production push.

## 1) Local pre-push checks

- `npm install`
- `npm run lint`
- `npx tsc --noEmit`
- Confirm required env vars exist in `.env.local`:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 2) Auth and account integration checks

- Sign up one test user through the app.
- Verify user exists in Prisma (`User`, `Membership`).
- Verify matching user exists in Supabase Auth (`auth.users`) with metadata:
  - `appUserId`
  - `role`
  - `teamId`
  - `isPlatformOwner`

## 3) Admin path checks

- Confirm `/admin/login` rejects non-Platform-Owner accounts.
- Confirm Platform Owner can access `/dashboard/admin`.
- Verify APIs as Platform Owner:
  - `GET /api/admin/users`
  - `GET /api/admin/users?source=supabase`
  - `POST /api/admin/users/[userId]/password`
  - `PATCH /api/admin/users/[userId]/status`

## 4) GitHub push checks

- `git status` includes only intended files.
- `git add -A`
- `git commit -m "..."` with clear scope.
- `git push origin <branch>`

## 5) Netlify deployment checks

- Confirm latest commit SHA appears in Netlify deploy log.
- Confirm build command runs successfully.
- Verify Netlify environment variables:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Smoke-test production routes:
  - `/login`
  - `/admin/login`
  - `/dashboard/admin` (Platform Owner only)

## 6) Post-deploy regression checks

- Regular role sign-ins still work:
  - Head Coach
  - Assistant Coach
  - Player
  - Parent
- Admin login still reaches support dashboard.
- Update profile email/name and confirm Supabase metadata sync still succeeds.

