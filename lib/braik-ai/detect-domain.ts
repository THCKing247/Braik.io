/**
 * Domain detection: determine what Braik data the question touches.
 */

import type { QuestionDomain } from "./types"

export function detectDomain(message: string): { domain: QuestionDomain; related: QuestionDomain[] } {
  const lower = message.toLowerCase().trim()
  const related: QuestionDomain[] = []

  const playerTriggers =
    /\b(start|bench|rank|compare|best|injured|healthy|available|stats?|who should (i )?start|which (qb|wr|rb)\s*should|return\s*kicks?|leads?\s*(the\s*team|defense)|mason|tyler|kenneth|should\s+\w+\s+start)\b/i.test(lower) ||
    /\b(player|players|receiver|linebacker|corner|qb|wr|rb)\b.*\b(start|rank|compare|best|healthy)\b/i.test(lower)

  const playbookTriggers =
    /\bplaybook|formation|subformation|\bplays?\s+(from|fit|with)|trips|bunch|gun\b|motion|route|concept|red\s*zone|3rd\s*and|goal\s*line|cover\s*3|flood|mesh|inside\s*zone|call\s*(a\s*)?play|recommend.*play|best\s*(red\s*zone\s*)?plays?|which\s*formations?|do i have any plays|plays?\s*fit|matchup\b|fit\s+that\s*matchup|my\s+plays?|which\s*play/i.test(lower)

  const injuryTriggers =
    /\binjury|questionable|out\b|limited|full\s*participant|healthy\s*enough|\bhealthy\b|availability|injury\s*report|who is (on the )?injury|hurt\b|doubtful/i.test(lower)

  const scheduleTriggers =
    /\bschedule|practice\b|game\b|event\b|when do we play|who do we play|play\s+next|tomorrow|this week|next\s*(game|week)|upcoming|events?|calendar/i.test(lower)

  const rosterTriggers =
    /\broster|depth\s*chart|how many\s*(lb|db|wr|qb|linebacker|db s?)|enough\s*(db|lbs?)|position\s*group|starters?\s*by\s*position|my\s*starters|backup\s*reps?|who may need\s*reps?/i.test(lower)

  const reportTriggers =
    /\breport\b|scouting\s*report|uploaded|document\b|practice\s*plan|injury\s*report\s*pdf|summarize|key\s*points\s*from|what does the (uploaded|practice)\s*(schedule|plan)\s*say/i.test(lower)

  if (playerTriggers) related.push("players")
  if (playbookTriggers) related.push("playbooks")
  if (injuryTriggers) related.push("injuries")
  if (scheduleTriggers) related.push("schedule")
  if (rosterTriggers) related.push("roster")
  if (reportTriggers) related.push("reports")

  const count = related.length
  if (count === 0) return { domain: "generic", related: ["roster"] }
  if (count >= 2) return { domain: "multi_domain", related }

  const d = related[0]
  if (d === "playbooks") return { domain: "playbooks", related }
  if (d === "injuries") return { domain: "injuries", related }
  if (d === "schedule") return { domain: "schedule", related }
  if (d === "reports") return { domain: "reports", related }
  if (d === "roster") return { domain: "roster", related }
  if (d === "players") return { domain: "players", related }
  return { domain: "generic", related }
}
