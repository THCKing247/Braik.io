# Phase 6 — Media, attachments, and bandwidth

## Goal

Keep messaging threads and dashboard media paths smooth by deferring bytes, avoiding redundant uploads/rerenders, and documenting secure attachment routes — **without** changing attachment semantics or exposing private files.

---

## 1. Attachment / media hot paths (inventory)

| Area | Location | Behavior |
|------|----------|----------|
| **Upload** | `POST /api/messages/attachments` — `app/api/messages/attachments/route.ts` | FormData `file`, `teamId`, optional `threadId`; type/size validation; creates `message_attachments` row (storage upload TODO in route comments). |
| **Metadata fetch** | `GET /api/messages/attachments/[attachmentId]`, `GET .../serve?fileUrl=` | Team access + thread participant (or admin); returns **JSON metadata** today (`Cache-Control` tightened in Phase 6 — see §4). |
| **Thread detail** | `GET /api/messages/threads/[threadId]` | Loads attachment rows by `message_id` — metadata only for composition in UI. |
| **Thread UI** | `MessageAttachmentList`, `LazyThreadAttachmentImage`, `MessageBubble` | **Authorized relative URLs** `/api/messages/attachments/:id` or serve query — **no public bucket URLs** in components. |
| **Realtime** | `use-message-realtime.ts` | INSERT on `messages` only — attachments unchanged (Phase 6 does not touch realtime). |
| **Composer upload client** | `messaging-manager.tsx` → `handleFileUpload` | FormData POST; duplicate-flight guard; resets `<input>` after attempt; passes `threadId` when thread selected. |
| **Heavy client libs** | Grep `components/**/*.tsx` for mammoth, jspdf, html2canvas, pdf-lib | **None** in components — document parsers stay server-side elsewhere (`lib/documents/extract-text.ts` dynamic mammoth). |
| **Dashboard video** | `app/(portal)/dashboard/(team)/game-video/page.tsx` | Scaffold only — no video element / player loaded on initial render beyond icon + copy. |
| **game_videos / video_clips** | Bootstrap payload / API routes | Not altered in Phase 6 beyond existing deferred bootstrap patterns. |

---

## 2. Security assumptions (unchanged)

- Private attachments must continue to go through **cookie-session–authenticated API routes** that enforce **team membership** and **thread participation** (or admin override where coded).
- **`Cache-Control: private, no-store`** on metadata JSON responses reduces accidental caching of per-user attachment listings on shared proxies.
- **No** switch from authorized `/api/messages/attachments/...` to public Supabase URLs unless an object is intentionally public (not done here).

---

## 3. Changes made

### 3.1 Messaging images — viewport deferral + thumbnails-ready model

| File | Change |
|------|--------|
| `components/portal/messaging/LazyThreadAttachmentImage.tsx` | **`IntersectionObserver`** (`rootMargin ~180px`) gates setting **`src`** so browsers **do not fetch** distant images. **`decoding="async"`**, reserved **`min-h/w`**, skeleton placeholder, explicit **“Open original”** link using **`fullSrc`** only (same authorized URL). Supports optional **`thumbnailSrc`** for lighter first paint when present. |
| `lib/messaging/attachment-display-types.ts` | **`ThreadMessageAttachment`** + **`attachmentThumbnailSrc`** — optional **`thumbnailUrl`** / **`metadata.thumbnailUrl`** without DB migration. |
| `components/portal/messaging/MessageAttachmentList.tsx` | **`memo`** with custom **`attachmentSignature`** compare so unchanged attachment arrays skip rerenders when props equal; non-images show **metadata card** (mime + **size**); images use thumbnail when available. |
| `components/portal/messaging/MessageBubble.tsx` | Typed attachments passthrough. |

**Prior behavior:** `<img src>` was present immediately (only visually hidden until `onLoad`), which still **downloaded** every image in the DOM path.

### 3.2 Upload UX / duplicate submissions

| File | Change |
|------|--------|
| `components/portal/messaging-manager.tsx` | **`attachmentUploadInFlightRef`** blocks overlapping uploads; **`setAttachments((prev) => [...])`** functional update; **`threadId`** appended when a thread is open; **`input.value = ""`** after each attempt so the same file can be re-selected; **`removeAttachment`** uses functional update. |
| `components/portal/messaging/MessageComposer.tsx` | Stable **`key`** using **`att.id`** when present. |

### 3.3 Storage API metadata responses

| File | Change |
|------|--------|
| `app/api/messages/attachments/[attachmentId]/route.ts` | **`Cache-Control: private, no-store`** on JSON metadata response. |
| `app/api/messages/attachments/serve/route.ts` | Same. |

Streaming binary bodies and **Range** support remain **follow-ups** (routes still return JSON until storage wiring is completed).

### 3.4 Dashboard / heavy bundles

- No new client imports of pdf/mammoth/jspdf in Phase 6.
- Game video page remains lightweight scaffold (no `<video>` autoplay or multi-player load).

---

## 4. Thumbnail support status

| Mechanism | Status |
|-----------|--------|
| **DB column** | Not added (per constraint). |
| **Application-level** | **`thumbnailUrl`** or **`metadata.thumbnailUrl`** on attachment objects — when API fills these (future), **`LazyThreadAttachmentImage`** prefers **`thumbnailSrc`** for the inline preview and keeps **`fullSrc`** for “Open original”. |
| **Fallback** | Same **`fullSrc`** as today when no thumbnail. |

---

## 5. Heavy libraries — placement

| Library | Where | Phase 6 note |
|---------|-------|----------------|
| **mammoth** | `lib/documents/extract-text.ts` (dynamic `import()`) | Not pulled into messaging bundle. |
| **jspdf / pdf-lib / html2canvas / qrcode** | No direct `components/` imports found | Keep using **dynamic import** only inside document/export flows when added. |
| **recharts** | AD dashboard (already dynamic in Phase 4) | Unchanged. |

---

## 6. Known follow-ups

1. **Binary delivery:** Implement **`storage.download` / filesystem stream** in attachment GET routes with **`Content-Type`**, **`Content-Disposition`**, optional **`Accept-Ranges`** for large video — preserve auth gates.
2. **Thumbnails:** Background job or upload-time resize writing **`thumbnailUrl`** into attachment metadata or storage path — optional migration later if persistent derivatives are required.
3. **Virtualized thread list:** `MessageViewport` TODO — long threads still render full list (existing note).

---

## 7. Validation

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run test:release-guards` | Pass |
| `npm run build` | Pass |

---

## 8. Files touched

- `components/portal/messaging/LazyThreadAttachmentImage.tsx`
- `components/portal/messaging/MessageAttachmentList.tsx`
- `components/portal/messaging/MessageBubble.tsx`
- `components/portal/messaging/MessageComposer.tsx`
- `components/portal/messaging/messaging-display-utils.ts`
- `components/portal/messaging-manager.tsx`
- `lib/messaging/attachment-display-types.ts`
- `app/api/messages/attachments/[attachmentId]/route.ts`
- `app/api/messages/attachments/serve/route.ts`
- `PHASE_6_MEDIA_PERFORMANCE_REPORT.md`

---

## 9. Success criteria mapping

| Criterion | How addressed |
|-----------|----------------|
| Image-heavy threads avoid eager fetch of every original | **IO-gated `src`**; optional **thumbnail** path; full file opened explicitly via **“Open original”** or navigation to same authorized URL only after interaction/near viewport. |
| Less rerender pressure on attachment UI | **`MessageAttachmentList` memo** + stable keys / signatures. |
| Upload avoids duplicate work | **In-flight ref**, functional **`setAttachments`**, input reset. |
| Private media | **Same API URLs**; **`no-store`** on metadata JSON. |
| No UI redesign | Layout preserved (minor addition: metadata lines for non-images, link label “Open original”). |
