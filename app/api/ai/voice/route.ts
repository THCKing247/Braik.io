import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { isOpenAIConfigured, transcribeCoachBAudio } from "@/lib/braik-ai/openai-client"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canUseCoachB, type Role } from "@/lib/auth/roles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/ai/voice
 * Multipart form: `audio` (Blob), `teamId` (string).
 * Auth + team scope + speech-to-text only. Client must POST the returned `transcript` to /api/ai/chat.
 */
export async function POST(req: Request) {
  console.log("[POST /api/ai/voice] received")

  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
  }

  const session = await getServerSession()
  if (!session?.user?.id) {
    console.warn("[POST /api/ai/voice] unauthorized")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const audio = formData.get("audio") ?? formData.get("file")
  const teamIdRaw = formData.get("teamId")

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 })
  }

  const teamId = typeof teamIdRaw === "string" && teamIdRaw.trim() ? teamIdRaw.trim() : ""
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 })
  }

  try {
    const { membership } = await requireTeamAccess(teamId)
    if (!canUseCoachB(membership.role as Role)) {
      return NextResponse.json({ error: "Coach B is only available to coaching and admin roles." }, { status: 403 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "You do not have access to this team." }, { status: 403 })
    }
    throw e
  }

  const arrayBuffer = await audio.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename =
    (audio instanceof File && audio.name?.trim()) || (audio as Blob & { name?: string }).name?.trim() || "recording.webm"

  console.log("[Coach B voice] transcribing", {
    userId: session.user.id,
    teamId,
    bytes: buffer.length,
  })

  const result = await transcribeCoachBAudio({ buffer, filename })
  if ("error" in result) {
    console.error("[Coach B voice] transcription error", result.error)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  if (!result.transcript) {
    console.warn("[Coach B voice] empty transcript", { userId: session.user.id, teamId })
    return NextResponse.json({ transcript: "", error: "No speech detected" }, { status: 200 })
  }

  console.log("[Coach B voice] transcription ok", {
    userId: session.user.id,
    teamId,
    charCount: result.transcript.length,
  })
  console.log("[Coach B voice] transcript ready for client → /api/ai/chat")

  return NextResponse.json({ transcript: result.transcript })
}
