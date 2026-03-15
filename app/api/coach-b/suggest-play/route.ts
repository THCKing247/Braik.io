import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import type { CoachBSuggestPlayResponse } from "@/lib/types/coach-b"
import { suggestPlays } from "@/lib/coach-b/suggest-play-service"

const LOG_PREFIX = "[coach-b/suggest-play]"

/** Validated request body for suggest-play. */
interface ValidatedBody {
  prompt: string
  playbookId?: string
  formationId?: string
  subFormationId?: string
}

function validateBody(raw: unknown): { ok: true; data: ValidatedBody } | { ok: false; status: number; error: string; detail: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, status: 400, error: "Invalid request body", detail: "Body must be a JSON object." }
  }
  const b = raw as Record<string, unknown>
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : ""
  if (!prompt) {
    return { ok: false, status: 400, error: "Validation failed", detail: "prompt is required and must be a non-empty string." }
  }
  const playbookId = typeof b.playbookId === "string" ? b.playbookId.trim() || undefined : undefined
  const formationId = typeof b.formationId === "string" ? b.formationId.trim() || undefined : undefined
  const subFormationId = typeof b.subFormationId === "string" ? b.subFormationId.trim() || undefined : undefined
  return {
    ok: true,
    data: { prompt, playbookId, formationId, subFormationId },
  }
}

/**
 * POST /api/coach-b/suggest-play
 * Returns structured play suggestions for a prompt. Uses suggest-play-service (stub or AI).
 */
export async function POST(request: Request) {
  try {
    console.info(LOG_PREFIX, "request received")

    // 1. Parse JSON safely
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      console.warn(LOG_PREFIX, "invalid JSON body")
      return NextResponse.json(
        { error: "Invalid request body", detail: "Request body must be valid JSON." },
        { status: 400 }
      )
    }

    // 2. Validate required fields
    const validated = validateBody(rawBody)
    if (!validated.ok) {
      console.warn(LOG_PREFIX, "validation failed:", validated.detail)
      return NextResponse.json(
        { error: validated.error, detail: validated.detail },
        { status: validated.status }
      )
    }
    const { prompt, playbookId, formationId, subFormationId } = validated.data
    console.info(LOG_PREFIX, "validated payload", { hasPrompt: true, playbookId: playbookId ?? null, formationId: formationId ?? null, subFormationId: subFormationId ?? null })

    // 3. Auth
    const session = await getServerSession()
    if (!session?.user?.id) {
      console.warn(LOG_PREFIX, "unauthorized: no session")
      return NextResponse.json({ error: "Unauthorized", detail: "You must be signed in to use Coach B." }, { status: 401 })
    }
    console.info(LOG_PREFIX, "authenticated user id", session.user.id)

    // 4. Optional: require OpenAI when AI is enabled (stub works without it)
    if (process.env.COACH_B_REQUIRE_OPENAI === "true" && !process.env.OPENAI_API_KEY) {
      console.error(LOG_PREFIX, "server misconfiguration: OPENAI_API_KEY required but missing")
      return NextResponse.json(
        { error: "Server misconfiguration", detail: "Missing OPENAI_API_KEY" },
        { status: 500 }
      )
    }

    // 5. If playbookId provided, verify user has access to that playbook's team
    if (playbookId) {
      const supabase = getSupabaseServer()
      const { data: playbook, error: playbookError } = await supabase
        .from("playbooks")
        .select("id, team_id")
        .eq("id", playbookId)
        .maybeSingle()

      if (playbookError) {
        console.error(LOG_PREFIX, "playbook lookup failed", { playbookId, error: playbookError.message })
        return NextResponse.json(
          { error: "Failed to verify playbook access", detail: "A temporary error occurred. Please try again." },
          { status: 500 }
        )
      }
      if (!playbook) {
        return NextResponse.json(
          { error: "Not found", detail: "Playbook not found." },
          { status: 404 }
        )
      }
      try {
        await requireTeamAccess(playbook.team_id as string)
      } catch (accessErr) {
        const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
        if (msg.includes("Unauthorized")) {
          console.warn(LOG_PREFIX, "unauthorized for playbook", { playbookId })
          return NextResponse.json({ error: "Unauthorized", detail: "You must be signed in to use Coach B." }, { status: 401 })
        }
        console.warn(LOG_PREFIX, "forbidden: no access to playbook team", { playbookId, teamId: playbook.team_id })
        return NextResponse.json(
          { error: "Forbidden", detail: "You do not have access to this playbook." },
          { status: 403 }
        )
      }
      console.info(LOG_PREFIX, "playbook/team lookup success", { playbookId })
    }

    // 6. Call suggest service (stub or AI)
    console.info(LOG_PREFIX, "suggestions call starting")
    const suggestions = await suggestPlays(prompt, {
      formationId,
      subFormationId,
      playbookId,
    })
    console.info(LOG_PREFIX, "suggestions call success", { count: suggestions.length })

    const response: CoachBSuggestPlayResponse = { suggestions }
    return NextResponse.json(response)
  } catch (error: unknown) {
    const err = error as Error & { message?: string }
    const message = err?.message ?? "Unknown error"
    console.error(LOG_PREFIX, "handler error", { message, name: err?.name })

    // Map known errors to safe JSON responses
    if (message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized", detail: "You must be signed in to use Coach B." },
        { status: 401 }
      )
    }
    if (message.includes("Access denied")) {
      return NextResponse.json(
        { error: "Forbidden", detail: "You do not have access to this resource." },
        { status: 403 }
      )
    }
    if (message.includes("OPENAI_API_KEY") || message.includes("not configured")) {
      return NextResponse.json(
        { error: "Server misconfiguration", detail: "Missing OPENAI_API_KEY" },
        { status: 500 }
      )
    }
    if (err?.name === "MembershipLookupError") {
      return NextResponse.json(
        { error: "Failed to verify access", detail: "A temporary error occurred. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to generate play suggestion",
        detail: "A temporary error occurred. Please try again.",
      },
      { status: 500 }
    )
  }
}
