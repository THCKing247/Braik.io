# Phase 7 — Mobile perceived performance

Focus: smooth authenticated portal experience on phones/tablets (no schema changes, no messaging rewrite).

## Mobile profiling checklist

Use Chrome DevTools device toolbar or real hardware.

1. **Throttle CPU** (4×) and optionally **Slow 4G** when verifying scroll/jank.
2. Record **Performance** panel while: opening sidebar route from More sheet, switching messages threads, typing in composer, scrolling long image threads.
3. Enable **Rendering → Paint flashing** briefly to catch unnecessary full-screen repaints (expect spikes at intentional transitions only).
4. Check **Layout Shift Regions** when navigating dashboard routes (CLS should stay minimal).
5. Respect **prefers-reduced-motion** — spinners fall back to static placeholders where implemented.

## Devices / breakpoints exercised (recommended)

| Breakpoint | Typical device |
|------------|----------------|
| &lt; 640px   | iPhone SE, small Android |
| 640–1023px | Large phone, small tablet |
| 1024px+    | Desktop (regression: sidebar must still appear) |

Tailwind `lg` = 1024px aligns with `useMinWidthLg` / dashboard shell.

## Key interactions (expected feel)

| Interaction | Expectation |
|-------------|-------------|
| Initial dashboard load | Static or low-motion skeletons on narrow viewports; no heavy pulse wave |
| Sidebar (desktop) | Not mounted on mobile; tab bar + More sheet only |
| More sheet open/close | Short transform; solid scrim; scroll area uses touch-friendly containment |
| Route change from More | Sheet closes; main content swaps without large layout jump |
| Messages open | Inbox or thread pane mounted alone on narrow screens (not both) |
| Thread switch | Message region loads; static bar on phone instead of continuous spin where applicable |
| Send message | Composer + thread pane isolated from inbox list (no full inbox reconcile on narrow) |
| Image-heavy thread scroll | `touch-scroll` + `overscroll-contain` on viewport; stable scrolling |
| Modal open/close | Lightweight overlay; dialog body scroll contained |

## Expected metrics (guidance, not guarantees)

- First meaningful interaction after tap: **&lt; 100 ms** perceived where possible (avoid main-thread spin loops).
- Scroll on message thread: **no sustained frame drops** during slow flick scroll on mid-tier phone profile.
- Route transition CLS: **no large jumps** from shell chrome (reserved paddings/tab bar unchanged).

## Files changed (Phase 7)

| Area | File |
|------|------|
| Dashboard shell | `components/portal/dashboard-layout-client.tsx` — desktop sidebar mounted only at `lg+` via `useMinWidthLg()` |
| Mobile tab bar | `components/portal/dashboard-mobile-tab-bar.tsx` — solid bg on narrow viewports; blur retained `lg+` |
| Messaging layout | `components/portal/messaging-manager.tsx` — conditional inbox/thread panes on narrow screens; touch scroll on lists/dialog |
| Message viewport | `components/portal/messaging/MessageViewport.tsx` — touch scroll, overscroll containment, lighter shadows on small screens, mobile-friendly loading |
| Route skeletons | `components/portal/dashboard-route-skeletons.tsx` — `max-lg:animate-none` on heavy pulse shells |
| More sheet | `components/portal/dashboard-more-bottom-sheet.tsx` — lighter shadow / shorter animation on mobile; `touch-scroll` on scroll body |
| Globals | `app/globals.css` — `overscroll-behavior: contain` on `.touch-scroll` |

## Validation

Commands run after changes (local, Phase 7 branch):

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass (`tsc --noEmit`) |
| `npm run test:release-guards` | Pass (`messaging-thread-validation.test.ts`) |
| `npm run build` | Pass (Next.js production build completed) |

Document results in CI / PR notes when merging.

## Scenario coverage (manual / reasoning)

- **iPhone-sized viewport:** Sidebar DOM absent; messages single-pane; tab bar without backdrop blur.
- **Android-sized viewport:** Same as above.
- **Tablet (768–1023px):** Still “mobile shell” below `lg`; sidebar deferred until 1024px.
- **Coach / player / parent / recruiter portals:** Shared `DashboardLayoutClient` + messaging — no route or auth changes.
- **Deep link `?threadId=`:** State still sets `mobileShowList` false; thread pane mounts when URL resolved.
- **Attachment / Coach B:** No behavioral changes; Coach B entry still via More sheet.

## Notes / non-goals

- No virtualization added to message lists (Phase 2 boundary preserved).
- No removal of features or redesign; GPU-heavy effects reduced only where they disproportionately hurt phones.
