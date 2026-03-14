/**
 * Intent detection: more specific goal of the question.
 */

import type { QuestionIntent } from "./types"

export function detectIntent(message: string): QuestionIntent {
  const lower = message.toLowerCase().trim()

  if (/\bwho should (i )?start|which\s+.+?should\s+(i )?start|should\s+\w+\s+start\b/i.test(lower)) return "player_decision"
  if (/\bcompare\b|who is better|versus\b|vs\.?\s|over\s+\w+/i.test(lower)) return "player_comparison"
  if (/\bevaluate\b|rank\s+my|what do you think|how is \w+ doing|thoughts on\b/i.test(lower)) return "player_evaluation"
  if (/\bwho is (injured|available|healthy)|availability\b|healthy enough/i.test(lower)) return "player_availability"
  if (/\bleads?\s*the team|stats?\b|statistics\b|most\s*\w+\s*(yards|tds|tackles)/i.test(lower)) return "player_stats"

  if (/\b(uploaded|practice\s*plan|scouting\s*report)\b/i.test(lower) && /\b(say|show|summarize|key\s*points)\b/i.test(lower)) return "report_summary"
  if (/\bwho do we play\b|when do we play|play\s+next\b/i.test(lower)) return "schedule_summary"
  if (/\bshow me\s+my\s+.+plays?|list\s+my\s+plays?|do i have any plays|find\s+(me\s+)?a\s*play|my\s+trips\s+right\s+plays?/i.test(lower)) return "play_lookup"
  if (/\brecommend|suggest|best\s*(play|red zone)|which\s*play\s*should|called?\s*from|fit\s+cover\s*3|plays?\s*fit|fit\s+that\s*matchup/i.test(lower)) return "play_recommendation"
  if (/\bwhich\s*formations?|formations?\s*(do i )?use/i.test(lower)) return "formation_lookup"

  if (/\binjury\s*report|who is (on the )?injury|availability\s*summary|game-?day\s*availability/i.test(lower)) return "injury_summary"
  if (/\bschedule|next\s*(game|week)|upcoming\s*(games?|practices?)|this week|tomorrow/i.test(lower)) return "schedule_summary"
  if (/\broster|depth\s*chart|how many\s*\w+s?|starters?\s*by\s*position/i.test(lower)) return "roster_summary"
  if (/\bsummarize|report\b|scouting|uploaded|practice\s*plan|key\s*points/i.test(lower)) return "report_summary"

  if (/\bgame\s*plan|game-?day|opponent\s*prep/i.test(lower)) return "game_planning"
  if (/\bpractice\s*plan|reps?\s*this\s*week|practice\s*participation/i.test(lower)) return "practice_planning"

  return "generic"
}
