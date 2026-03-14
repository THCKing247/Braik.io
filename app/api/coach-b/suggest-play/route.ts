import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import type { CoachBSuggestPlayRequest, CoachBSuggestPlayResponse, PlaySuggestion } from "@/lib/types/coach-b"

/**
 * POST /api/coach-b/suggest-play
 * Returns structured play suggestions for a prompt. Stub implementation; replace with real AI later.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()).catch(() => ({})) as CoachBSuggestPlayRequest
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    // Stub: return 1–2 structured suggestions based on prompt keywords. Real integration would call an LLM with a structured-output schema.
    const suggestions = getStubSuggestions(prompt)

    const response: CoachBSuggestPlayResponse = { suggestions }
    return NextResponse.json(response)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/coach-b/suggest-play]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to get suggestions" },
      { status: 500 }
    )
  }
}

function getStubSuggestions(prompt: string): PlaySuggestion[] {
  const lower = prompt.toLowerCase()
  const suggestions: PlaySuggestion[] = []

  if (lower.includes("3rd") && (lower.includes("6") || lower.includes("medium")) && (lower.includes("pass") || lower.includes("trips"))) {
    suggestions.push({
      playName: "Trips Right Stick",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Go" },
        { role: "WR2", route: "Stick" },
        { role: "WR3", route: "Out" },
        { role: "RB", route: "Flat" },
      ],
      rationale: "Stick concept from Trips Right gives you a high-low read; RB flat keeps the backer honest. Good for 3rd and medium.",
    })
  }

  if (lower.includes("trips") && (lower.includes("right") || lower.includes("left"))) {
    const side = lower.includes("right") ? "Right" : "Left"
    suggestions.push({
      playName: `Trips ${side} Smash`,
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Smash" },
        { role: "WR2", route: "Curl" },
        { role: "WR3", route: "Out" },
        { role: "RB", route: "Check release" },
      ],
      rationale: "Smash from Trips gives a corner route with an underneath option. Works well vs cover 2 or 3.",
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      playName: "Quick concept",
      conceptType: "Pass",
      routesByRole: [
        { role: "WR1", route: "Slant" },
        { role: "WR2", route: "Out" },
        { role: "RB", route: "Flat" },
      ],
      rationale: "A simple quick-game concept. Refine your prompt (e.g. down and distance, formation) for more specific suggestions.",
    })
  }

  return suggestions
}
