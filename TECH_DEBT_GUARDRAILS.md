# Technical debt guardrails

Lightweight rules to keep Braik maintainable while performance and cleanup phases run. **Do not expand scope** in unrelated PRs; prefer follow-up tickets.

Related: [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md) (first render, bootstrap, fetch duplication), [PERFORMANCE_BASELINE.md](./PERFORMANCE_BASELINE.md).

---

## 1. Fetch ownership (UI vs helpers)

**Rule:** Do not add raw `fetch("/api/...")` (or template-literal API URLs) **directly inside presentational UI** when the same request should be owned by:

- A **typed API helper** (e.g. under `lib/api-client/`, `lib/**/`*`-queries.ts`, or feature `lib/<feature>/...`), or  
- A **React Query hook** (e.g. `useDashboardShellQuery`, `useDashboardBootstrapQuery`, or a dedicated `useQuery` with a stable key).

**Allowed exceptions (keep narrow):**

- **Central data hooks** that wrap `fetch` once (e.g. `lib/dashboard/dashboard-shell-query.ts` for `/api/dashboard/shell`).
- **One-off mutations** inside an existing manager component **until** a helper exists — but new endpoints should get a helper in the same or next PR when feasible.
- **Marketing / native** thin forms that only POST once, if kept minimal.

**PR review:** If you add `fetch` in `components/**`, link or add the owning module in the PR description.

---

## 2. Dashboard loading vs shell/bootstrap

**Rule:** Do not add **full-page dashboard skeletons** (replacing the whole main column or hiding the team shell) **after** dashboard **shell** or **bootstrap** already exposes the identity and team context needed to render structure.

**Prefer:**

- **Granular** placeholders (rows, cards, widgets) — see `dashboard-route-skeletons.tsx`, `DashboardPageShell` patterns, and PERFORMANCE_GUIDELINES §C.
- **Inline** “refreshing…” affordances where bootstrap is refetching but the shell is valid.

**PR review:** New loading UI should state what data it is waiting for (e.g. “deferred roster slice”) vs “user unknown”.

---

## 3. `"use client"` on route `page.tsx`

**Rule:** Do not mark **large** `app/**/page.tsx` files as `"use client"` **unless** hooks, browser-only APIs, or event handlers require it.

**Prefer:**

- **Server** `page.tsx` that composes **small client islands** when the product allows.
- Keep client pages **thin** — push logic into hooks or `components/portal/...`.

**PR review:** If `page.tsx` grows past ~150 lines and stays client-only, note a future split in the PR or a ticket.

---

## 4. Global `lib/` and shared `components/`

**Rule:** Do not add **feature-specific** business logic to **generic** trees unless it is **genuinely cross-feature**:

- Avoid new playbook-only, roster-only, or messaging-only helpers under `lib/utils/` when a feature module (`lib/roster/`, `lib/playbooks/`, `components/portal/...`) is the right home.
- Shared UI belongs in `components/ui/` or clearly named `components/portal/` modules, not ad-hoc “misc” files.

**PR review:** New `lib/` files should name the **domain** (or reference a product area).

---

## 5. API route response shape

**Rule:** Every **new** App Router API handler (`app/api/**/route.ts`) should return a **consistent, typed JSON shape** for both success and expected errors, so clients can narrow without guessing.

**Recommended pattern (choose one per route family and stick to it):**

- `{ ok: true, ...payload }` / `{ ok: false, error: string, ...details }`, or  
- `{ success: true, ... }` / `{ success: false, message: string }`  
  **plus** appropriate HTTP status codes.

**PR review:** Link a type (e.g. in `lib/**/types` or next to the route) or Zod schema used by the handler.

---

## 6. Owning feature area (every PR)

**Rule:** Every **feature PR** must state its **owning feature area** in the description (see `.github/pull_request_template.md`) so reviewers route consistency, permissions, and perf checks to the right mental model.

**Examples:** `Dashboard / Roster`, `Messaging`, `Playbooks`, `Film / game video`, `Billing`, `Marketing`, `Player portal`, `Admin`, `Platform / auth`.

---

## Tracking in-repo

Search for **`TECH_DEBT:`** in the codebase for TODOs tied to these rules (incremental cleanup; no large refactors required in the tagging phase).
