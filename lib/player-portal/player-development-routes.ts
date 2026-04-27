/**
 * Player portal — mobile IA & development loop
 *
 * **Primary nav (5 tabs):** Feed · Calendar · Messages · Team · Profile.
 * Keeps thumb navigation predictable; no extra top-level tabs for Study/Film/Playbooks.
 *
 * **Team hub (`/prep/film`):** Secondary segmented nav — Study → Game Film → Playbooks.
 * - **Study** holds assignments and **quizzes** (StudyGuidesModule); quizzes are not a separate route.
 * - **Film** = team video library (prep / recognition).
 * - **Playbooks** = installs & diagrams (apply what you studied).
 *
 * **Feedback loop (conceptual):** Learn & quiz (Study) → watch/clip (Film) & schemes (Playbooks) → questions or notes
 * to staff via **Messages**; **Home** surfaces coach announcements. Calendar ties schedule to the same rhythm.
 *
 * Use these builders everywhere so paths stay consistent as the hub scales.
 */

/** `/player/:accountSegment` */
export function playerPortalRoot(accountSegment: string): string {
  return `/player/${encodeURIComponent(accountSegment)}`
}

/** Film hub root — team video library landing. */
export function playerFilmHubRoot(accountSegment: string): string {
  return `${playerPortalRoot(accountSegment)}/prep/film`
}

export function playerFilmHubStudy(accountSegment: string): string {
  return `${playerFilmHubRoot(accountSegment)}/study`
}

export function playerFilmHubPlaybooks(accountSegment: string): string {
  return `${playerFilmHubRoot(accountSegment)}/playbooks`
}

/** When you already have portal base path `/player/:id` (no trailing slash). */
export function playerFilmHubRootFromPortalBase(portalBase: string): string {
  return `${portalBase.replace(/\/$/, "")}/prep/film`
}

export function playerFilmHubStudyFromPortalBase(portalBase: string): string {
  return `${playerFilmHubRootFromPortalBase(portalBase)}/study`
}

export function playerFilmHubPlaybooksFromPortalBase(portalBase: string): string {
  return `${playerFilmHubRootFromPortalBase(portalBase)}/playbooks`
}

/** Ordered segments for the Team tab hub UI (Study → Game Film → Playbooks). */
export const PLAYER_FILM_HUB_SECTIONS = [
  { key: "study", label: "Study", suffix: "/study" as const },
  { key: "film", label: "Game Film", suffix: "" as const },
  { key: "playbooks", label: "Playbooks", suffix: "/playbooks" as const },
] as const

export type PlayerFilmHubSectionKey = (typeof PLAYER_FILM_HUB_SECTIONS)[number]["key"]
