/**
 * Rotating Coach B sidebar / empty-state copy. Keeps the assistant feeling fresh without extra API calls.
 */

export const COACH_B_PRODUCT_TIPS: string[] = [
  "Tip: Mention a formation or concept (e.g. “Trips red zone”) for tighter playbook answers.",
  "Tip: Ask “who’s limited this week?” to pull injury and practice context when it’s in Braik.",
  "Tip: Use the team picker so Coach B always scopes to the roster and schedule you mean.",
  "Tip: For installs, reference your playbook name—Coach B maps questions to those structures.",
  "Tip: Pin announcements for game week so families see time changes without digging through threads.",
]

export const COACH_B_COACHING_TIPS: string[] = [
  "Coaching note: Pair quick game with max protect when the defense shows heavy pressure tendencies.",
  "Coaching note: In the red zone, stress spacing and back-shoulder timing before adding new concepts.",
  "Coaching note: Third-and-medium is a great down to confirm stick/mesh answers vs. man indicators.",
  "Coaching note: After a bad series, one corrective period often beats a full install the next day.",
  "Coaching note: Special teams reps compound—track who gets live looks, not just starters.",
]

const SUBTITLES: string[] = [
  "Ask about your team, schedule, or installs.",
  "Ground answers in your Braik roster, injuries, and playbook data.",
  "Short, practical replies—built for the sideline and the staff room.",
]

export function coachBRotatingSubtitle(tick: number): string {
  return SUBTITLES[((tick % SUBTITLES.length) + SUBTITLES.length) % SUBTITLES.length]
}

export function coachBRotatingInsight(tick: number): string {
  const merged = [...COACH_B_PRODUCT_TIPS, ...COACH_B_COACHING_TIPS]
  const i = ((tick % merged.length) + merged.length) % merged.length
  return merged[i]
}
