/**
 * Coach B suggest-play service interface.
 * Implement this with a real AI/LLM when available; stub is used until then.
 */

import type { PlaySuggestion } from "@/lib/types/coach-b"

export interface SuggestPlayContext {
  formationId?: string
  subFormationId?: string
  playbookId?: string
}

/**
 * Return structured play suggestions for a natural-language prompt.
 * Replace the stub implementation with an AI service that returns the same shape.
 */
export async function suggestPlays(prompt: string, context: SuggestPlayContext): Promise<PlaySuggestion[]> {
  // Stub: keyword-based rules. Replace with AI client (e.g. OpenAI structured output) when ready.
  return getStubSuggestions(prompt, context)
}

function getStubSuggestions(prompt: string, _ctx: SuggestPlayContext): PlaySuggestion[] {
  const lower = prompt.toLowerCase()
  const suggestions: PlaySuggestion[] = []
  const isRedZone = lower.includes("red zone") || lower.includes("redzone")
  const isThirdDown = lower.includes("3rd") || lower.includes("third down")
  const tags: string[] = []
  if (isRedZone) tags.push("Red Zone")
  if (isThirdDown) tags.push("3rd Down")

  if (lower.includes("3rd") && (lower.includes("6") || lower.includes("medium")) && (lower.includes("pass") || lower.includes("trips"))) {
    suggestions.push({
      playName: "Trips Right Stick",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Go", yards: 12 },
        { role: "WR2", route: "Stick", yards: 5 },
        { role: "WR3", route: "Out", yards: 10 },
        { role: "RB", route: "Flat", yards: 2 },
      ],
      rationale: "Stick concept from Trips gives you a high-low read; RB flat keeps the backer honest. Good for 3rd and medium.",
      concept: "Stick",
      tags: tags.length ? tags : undefined,
    })
  }

  if ((lower.includes("red zone") || lower.includes("redzone")) && lower.includes("bunch")) {
    suggestions.push({
      playName: "Bunch Flood",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Corner", yards: 12 },
        { role: "WR2", route: "Out", yards: 10 },
        { role: "WR3", route: "Flat", yards: 2 },
      ],
      rationale: "Flood from Bunch creates a high-low stretch in the red zone. Good vs zone.",
      concept: "Flood",
      tags: ["Red Zone"],
    })
  }

  if ((lower.includes("quick") || lower.includes("quick game")) && lower.includes("empty")) {
    suggestions.push({
      playName: "Empty Quick Game",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Slant", yards: 4 },
        { role: "WR2", route: "Hitch", yards: 3 },
        { role: "WR3", route: "Out", yards: 5 },
        { role: "WR4", route: "Flat", yards: 1 },
      ],
      rationale: "Quick game from Empty spreads the field. Get the ball out fast to the open man.",
      concept: "Stick",
      tags: tags.length ? tags : undefined,
    })
  }

  if (lower.includes("trips") && (lower.includes("right") || lower.includes("left") || lower.includes("smash"))) {
    const side = lower.includes("right") ? "Right" : "Left"
    if (!suggestions.some((s) => s.playName.includes("Smash"))) {
      suggestions.push({
        playName: `Trips ${side} Smash`,
        conceptType: "Pass",
        routesByRole: [
          { role: "WR1", route: "Corner", yards: 12 },
          { role: "WR2", route: "Curl", yards: 12 },
          { role: "WR3", route: "Flat", yards: 2 },
          { role: "RB", route: "Check release", yards: 2 },
        ],
        rationale: "Smash from Trips gives a corner route with an underneath option. Works well vs cover 2 or 3.",
        concept: "Smash",
        tags: tags.length ? tags : undefined,
      })
    }
  }

  if (lower.includes("bunch") && suggestions.length === 0) {
    suggestions.push({
      playName: "Bunch Mesh",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Go", yards: 8 },
        { role: "WR2", route: "Drag", yards: 5 },
        { role: "WR3", route: "Drag", yards: 5 },
      ],
      rationale: "Mesh from Bunch creates natural picks and crossers. Good for man or zone.",
      concept: "Mesh",
      tags: tags.length ? tags : undefined,
    })
  }

  if (lower.includes("empty") && suggestions.length === 0) {
    suggestions.push({
      playName: "Empty Verticals",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Go" },
        { role: "WR2", route: "Go" },
        { role: "WR3", route: "Go" },
        { role: "WR4", route: "Go" },
      ],
      rationale: "Four verts from Empty stresses the defense vertically. Read the safety.",
      concept: "Four Verticals",
      tags: tags.length ? tags : undefined,
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      playName: "Quick concept",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Slant", yards: 4 },
        { role: "WR2", route: "Out", yards: 8 },
        { role: "RB", route: "Flat", yards: 2 },
      ],
      rationale: "A simple quick-game concept. Refine your prompt (e.g. down and distance, formation) for more specific suggestions.",
    })
  }

  return suggestions
}
