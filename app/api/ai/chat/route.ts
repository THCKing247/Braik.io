import { NextResponse } from "next/server"
import { buildContext } from "@/lib/braik-ai/context-builder"
import { runCoordinatorTool } from "@/lib/braik-ai/coordinator-tools"
import { detectFollowUp, getLastUserMessage, resolveFollowUpContext } from "@/lib/braik-ai/follow-up"
import { buildCoachBPrompt, createGenericContext } from "@/lib/braik-ai/prompt-builder"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess, MembershipLookupError, profileRoleToNormalizedRole } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

export async function POST(req: Request) {
  if (!isOpenAIConfigured()) {
    console.error("[POST /api/ai/chat] OPENAI_API_KEY missing")
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    )
  }

  let body: { teamId?: string; role?: string; message?: string; conversationHistory?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch (e) {
    console.error("[POST /api/ai/chat] Invalid JSON")
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "message must be a non-empty string" }, { status: 400 })
  }

  const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : undefined

  let viewerRoleLabel: string | undefined
  if (teamId) {
    try {
      const { membership } = await requireTeamAccess(teamId)
      if (!canUseCoachB(membership.role as Role)) {
        return NextResponse.json({ error: "Coach B is only available to coaching and admin roles." }, { status: 403 })
      }
      viewerRoleLabel = membership.role
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (err instanceof MembershipLookupError) {
        console.error("[POST /api/ai/chat] membership lookup failed", err)
        return NextResponse.json({ error: "Failed to verify team access" }, { status: 500 })
      }
      if (msg.includes("Access denied") || msg.includes("Not a member")) {
        return NextResponse.json({ error: "You do not have access to this team." }, { status: 403 })
      }
      throw err
    }
  } else {
    const supabase = getSupabaseServer()
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    const r = profileRoleToNormalizedRole((prof as { role?: string } | null)?.role)
    if (!canUseCoachB(r as Role)) {
      return NextResponse.json({ error: "Coach B is only available to coaching and admin roles." }, { status: 403 })
    }
    viewerRoleLabel = r
  }

  const history = Array.isArray(body.conversationHistory) ? body.conversationHistory : []
  let context = createGenericContext()
  if (teamId) {
    try {
      const result = await buildContext(teamId, message)
      if (result) {
        let resolvedContext = result.context
        if (detectFollowUp(message, history)) {
          const lastUserMsg = getLastUserMessage(history)
          if (lastUserMsg) {
            const priorResult = await buildContext(teamId, lastUserMsg)
            if (priorResult) {
              resolvedContext = resolveFollowUpContext(message, history, result.context, priorResult.context)
              console.log("[POST /api/ai/chat] follow-up resolved: reusing prior context")
            }
          }
        }
        context = resolvedContext
        console.log("[POST /api/ai/chat]", {
          domain: result.summary.domain,
          intent: result.summary.intent,
          rosterCount: result.summary.rosterCount,
          playbookCount: result.summary.playbookCount,
          playCount: result.summary.playCount,
          injuryCount: result.summary.injuryCount,
          scheduleCount: result.summary.scheduleCount,
          namedPlayersMatched: result.summary.namedPlayersMatched,
          positionsMatched: result.summary.positionsMatched,
        })
      } else {
        context = createGenericContext(["Braik context could not be loaded."])
        console.log("[POST /api/ai/chat] context unavailable, generic mode")
      }
    } catch (err) {
      console.error("[POST /api/ai/chat] context build failed", err)
      context = createGenericContext(["Context build failed; answering from general knowledge."])
    }
  } else {
    console.log("[POST /api/ai/chat] no teamId, generic mode")
  }

  const coordinatorAnalysis = runCoordinatorTool(context, message)
  const prompt = buildCoachBPrompt({
    context,
    message,
    history,
    coordinatorAnalysis,
    role: viewerRoleLabel,
  })
  if (process.env.BRAIK_AI_DEBUG === "1") {
    console.log("[Coach B debug] route: using context domain=%s hasTeam=%s", context.domain, context.team != null)
  }

  trackProductEventServer({
    eventName: BRAIK_EVENTS.coach_b.prompt_submitted,
    eventCategory: "coach_b",
    userId: session.user.id,
    teamId: teamId ?? null,
    role: viewerRoleLabel ?? null,
    metadata: {
      domain: context.domain,
      intent: context.intent,
      coordinator_tool: coordinatorAnalysis?.tool ?? null,
    },
  })

  try {
    const text = await sendCoachBPrompt(prompt.instructions, prompt.input)
    trackProductEventServer({
      eventName: BRAIK_EVENTS.coach_b.response_completed,
      eventCategory: "coach_b",
      userId: session.user.id,
      teamId: teamId ?? null,
      role: viewerRoleLabel ?? null,
      metadata: { domain: context.domain, intent: context.intent },
    })
    return NextResponse.json({ response: text, type: "response" })
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/ai/chat] OpenAI failed", details)
    trackProductEventServer({
      eventName: BRAIK_EVENTS.coach_b.response_error,
      eventCategory: "coach_b",
      userId: session.user.id,
      teamId: teamId ?? null,
      role: viewerRoleLabel ?? null,
      metadata: { domain: context.domain, intent: context.intent },
    })
    return NextResponse.json({ error: "AI chat failed", details }, { status: 500 })
  }
}
