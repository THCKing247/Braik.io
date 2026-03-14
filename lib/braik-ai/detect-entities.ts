/**
 * Entity detection: named players, positions, formations, plays, concepts, dates, opponents.
 */

import type { DetectedEntities } from "./types"

const POSITION_PATTERNS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bqb\b|quarterback/i, token: "QB" },
  { pattern: /\brb\b|running back|halfback|tailback/i, token: "RB" },
  { pattern: /\bwr\b|wide receiver/i, token: "WR" },
  { pattern: /\bte\b|tight end/i, token: "TE" },
  { pattern: /\bol\b|offensive line|lineman/i, token: "OL" },
  { pattern: /\bdl\b|defensive line|d-?line/i, token: "DL" },
  { pattern: /\blb\b|linebacker/i, token: "LB" },
  { pattern: /\bdb\b|defensive back|corner\b|safety\b|cb\b/i, token: "DB" },
  { pattern: /\bcb\b|cornerback/i, token: "CB" },
  { pattern: /\bk\b(?!\w)|kicker|placekicker/i, token: "K" },
  { pattern: /\bp\b(?!\w)|punter/i, token: "P" },
  { pattern: /\bkr\b|kick\s*return/i, token: "KR" },
  { pattern: /\bpr\b|punt\s*return/i, token: "PR" },
]

const FORMATION_NAMES = [
  "trips right", "trips left", "gun bunch", "gun spread", "empty", "i formation",
  "pistol", "wildcat", "single wing", "double wing", "spread", "pro set",
]

const CONCEPT_PATTERNS = [
  "flood", "mesh", "levels", "stick", "snag", "shallow", "drive", "spot",
  "inside zone", "outside zone", "power", "counter", "trap", "draw",
  "cover 3", "cover 2", "cover 4", "man", "zone", "blitz",
  "red zone", "goal line", "3rd and short", "3rd and medium", "3rd and long",
  "two minute", "four minute", "motion", "shift", "play action",
]

export function detectEntities(message: string, rosterForNames?: Array<{ first_name: string | null; last_name: string | null; preferred_name: string | null }>): DetectedEntities {
  const lower = message.toLowerCase().trim()
  const namedPlayers: string[] = []
  const positions: string[] = []
  const formationNames: string[] = []
  const playNames: string[] = []
  const concepts: string[] = []
  const dateTimeRefs: string[] = []
  const opponents: string[] = []

  for (const { pattern, token } of POSITION_PATTERNS) {
    if (pattern.test(lower) && !positions.includes(token)) positions.push(token)
  }

  for (const form of FORMATION_NAMES) {
    if (lower.includes(form) && !formationNames.includes(form)) formationNames.push(form)
  }
  if (/\btrips\b/i.test(lower)) formationNames.push("trips")
  if (/\bbunch\b/i.test(lower)) formationNames.push("bunch")
  if (/\bgun\b/i.test(lower)) formationNames.push("gun")

  for (const c of CONCEPT_PATTERNS) {
    if (lower.includes(c) && !concepts.includes(c)) concepts.push(c)
  }
  if (/\bred\s*zone/i.test(lower)) concepts.push("red zone")
  if (/\bgoal\s*line/i.test(lower)) concepts.push("goal line")
  if (/\b3rd\s*and\s*medium/i.test(lower)) concepts.push("3rd and medium")
  if (/\bcover\s*3/i.test(lower)) concepts.push("cover 3")

  if (/\btoday\b/i.test(lower)) dateTimeRefs.push("today")
  if (/\btomorrow\b/i.test(lower)) dateTimeRefs.push("tomorrow")
  if (/\bthis\s*week/i.test(lower)) dateTimeRefs.push("this week")
  if (/\bnext\s*(game|week)/i.test(lower)) dateTimeRefs.push("next game")
  if (/\bfriday|monday|saturday\b/i.test(lower)) dateTimeRefs.push(lower.match(/\b(friday|monday|saturday)\b/i)?.[0] ?? "weekday")

  if (rosterForNames?.length) {
    const words = lower.split(/\s+/).filter((w) => w.length > 1)
    for (const p of rosterForNames) {
      const first = (p.first_name ?? "").toLowerCase()
      const last = (p.last_name ?? "").toLowerCase()
      const preferred = (p.preferred_name ?? "").toLowerCase()
      const full = `${first} ${last}`.trim()
      if (first && (lower.includes(first) || words.some((w) => w === first))) namedPlayers.push(full || first)
      else if (last && (lower.includes(last) || words.some((w) => w === last))) namedPlayers.push(full || last)
      else if (preferred && lower.includes(preferred)) namedPlayers.push(preferred)
      else if (full && lower.includes(full)) namedPlayers.push(full)
    }
  }

  const vsMatch = lower.match(/\b(?:vs\.?|versus)\s+(\w+(?:\s+\w+)?)/i)
  if (vsMatch) opponents.push(vsMatch[1].trim())
  const nextOppMatch = lower.match(/next\s*opponent|play\s+next|who\s+do\s+we\s+play/i)
  if (nextOppMatch) dateTimeRefs.push("next opponent")

  return {
    namedPlayers: [...new Set(namedPlayers)],
    positions,
    formationNames,
    playNames,
    concepts,
    dateTimeRefs,
    opponents,
  }
}
