import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { suggestClipMetadataFromText, insertAiJobCompleted } from "@/lib/video/ai-clip-assist"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { createClip: true, view: true })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const ent = await resolveEffectiveVideoEntitlements(supabase, teamId)
    if (!ent) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    let body: { notes?: string; transcript?: string; existingTitle?: string | null }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const text = [typeof body.transcript === "string" ? body.transcript : "", typeof body.notes === "string" ? body.notes : ""]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n")

    const result = await suggestClipMetadataFromText(ent, {
      notesOrTranscript: text,
      existingTitle: body.existingTitle ?? null,
    })

    if (!result.ok) {
      const status =
        result.code === "OPENAI_NOT_CONFIGURED" ? 503 : result.code === "EMPTY_INPUT" ? 400 : result.code === "AI_DISABLED" ? 403 : 400
      return NextResponse.json({ error: result.message, code: result.code }, { status })
    }

    await insertAiJobCompleted(supabase, {
      teamId,
      jobType: "clip_metadata_suggestion",
      input: { chars: text.length },
      output: {
        suggestedTitle: result.suggestedTitle,
        suggestedTags: result.suggestedTags,
      },
    }).catch(() => undefined)

    return NextResponse.json({
      suggestedTitle: result.suggestedTitle,
      suggestedDescription: result.suggestedDescription,
      suggestedTags: result.suggestedTags,
    })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
