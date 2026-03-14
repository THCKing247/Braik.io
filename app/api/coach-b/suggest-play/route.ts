import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import type { CoachBSuggestPlayRequest, CoachBSuggestPlayResponse } from "@/lib/types/coach-b"
import { suggestPlays } from "@/lib/coach-b/suggest-play-service"

/**
 * POST /api/coach-b/suggest-play
 * Returns structured play suggestions for a prompt. Uses suggest-play-service (stub or AI).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()).catch(() => ({})) as CoachBSuggestPlayRequest
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const playbookId = typeof body.playbookId === "string" ? body.playbookId : undefined
    const formationId = typeof body.formationId === "string" ? body.formationId : undefined
    const subFormationId = typeof body.subFormationId === "string" ? body.subFormationId : undefined

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const suggestions = await suggestPlays(prompt, {
      formationId,
      subFormationId,
      playbookId,
    })

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
