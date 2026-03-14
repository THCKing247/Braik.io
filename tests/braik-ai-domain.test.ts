/**
 * Braik AI domain and intent detection fixtures.
 * Verifies multi-domain routing for Coach B.
 * Run: npx tsx tests/braik-ai-domain.test.ts
 */
import { detectDomain } from "../lib/braik-ai/detect-domain"
import { detectIntent } from "../lib/braik-ai/detect-intent"
import { detectEntities } from "../lib/braik-ai/detect-entities"

const FIXTURES: Array<{ message: string; expectedDomain: string; expectedRelated: string[]; expectedIntent?: string }> = [
  {
    message: "Which QB should I start?",
    expectedDomain: "players",
    expectedRelated: ["players"],
    expectedIntent: "player_decision",
  },
  {
    message: "Rank my receivers",
    expectedDomain: "players",
    expectedRelated: ["players"],
    expectedIntent: "player_evaluation",
  },
  {
    message: "Show me my Trips Right plays",
    expectedDomain: "playbooks",
    expectedRelated: ["playbooks"],
    expectedIntent: "play_lookup",
  },
  {
    message: "Who is on the injury report?",
    expectedDomain: "multi_domain",
    expectedRelated: ["injuries"],
    expectedIntent: "injury_summary",
  },
  {
    message: "Who do we play next?",
    expectedDomain: "schedule",
    expectedRelated: ["schedule"],
    expectedIntent: "schedule_summary",
  },
  {
    message: "Which healthy WR should start this week?",
    expectedDomain: "multi_domain",
    expectedRelated: ["players", "injuries", "schedule"],
    expectedIntent: "player_decision",
  },
  {
    message: "What are my best red zone plays from Trips Right?",
    expectedDomain: "multi_domain",
    expectedRelated: ["playbooks"],
    expectedIntent: "play_recommendation",
  },
  {
    message: "Who do we play next and what plays fit that matchup?",
    expectedDomain: "multi_domain",
    expectedRelated: ["schedule", "playbooks"],
    expectedIntent: "schedule_summary",
  },
  {
    message: "Summarize the injury report and tell me who may need backup reps",
    expectedDomain: "multi_domain",
    expectedRelated: ["injuries", "reports", "roster"],
    expectedIntent: "injury_summary",
  },
  // Report-related: documents/reports domain and intent (domain may be reports or multi_domain)
  {
    message: "Summarize the injury report",
    expectedDomain: "multi_domain",
    expectedRelated: ["injuries", "reports"],
    expectedIntent: "injury_summary",
  },
  {
    message: "What does the practice plan say?",
    expectedDomain: "multi_domain",
    expectedRelated: ["reports"],
    expectedIntent: "report_summary",
  },
  {
    message: "Pull out key points from the scouting report",
    expectedDomain: "multi_domain",
    expectedRelated: ["reports"],
    expectedIntent: "report_summary",
  },
  {
    message: "What does the uploaded schedule show?",
    expectedDomain: "multi_domain",
    expectedRelated: ["reports"],
    expectedIntent: "report_summary",
  },
]

function run() {
  let passed = 0
  let failed = 0

  for (const { message, expectedDomain, expectedRelated, expectedIntent } of FIXTURES) {
    const { domain, related } = detectDomain(message)
    const intent = detectIntent(message)
    const entities = detectEntities(message, [])

    const domainOk = domain === expectedDomain
    const relatedOk = expectedRelated.every((d) => related.includes(d))
    const intentOk = expectedIntent == null || intent === expectedIntent

    if (domainOk && relatedOk && intentOk) {
      passed++
    } else {
      failed++
      console.error("Fail:", message.slice(0, 60))
      if (!domainOk) console.error("  domain: expected %s, got %s", expectedDomain, domain)
      if (!relatedOk) console.error("  related: expected %s, got %s", expectedRelated, related)
      if (!intentOk) console.error("  intent: expected %s, got %s", expectedIntent, intent)
    }
  }

  if (failed > 0) {
    console.error("\n%d failed, %d passed", failed, passed)
    process.exit(1)
  }
  console.log("All %d Braik AI domain/intent fixtures passed.", passed)
}

run()
