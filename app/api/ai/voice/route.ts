import { NextResponse } from "next/server"
import {
  applyRefreshedSessionCookies,
  getRequestUserLite,
  type SessionUser,
} from "@/lib/auth/server-auth"
import {
  isOpenAIConfigured,
  transcribeCoachBAudio,
} from "@/lib/braik-ai/openai-client"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import {
  COACH_B_VOICE_MAX_BYTES,
  type CoachBVoiceErrorCode,
} from "@/lib/braik-ai/coach-b-voice-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_AUDIO_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/oga",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
  "video/webm",
])

function extensionFromFilename(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ""
}

function isAllowedCoachBAudio(blob: Blob, filename: string): boolean {
  const raw = (blob.type || "").toLowerCase()
  const base = raw.split(";")[0]?.trim() || ""
  if (base && ALLOWED_AUDIO_MIME.has(base)) return true
  const ext = extensionFromFilename(filename)
  return ext === "webm" || ext === "ogg" || ext === "mp3" || ext === "wav" || ext === "m4a" || ext === "mp4" || ext === "oga"
}

function voiceJson(
  body: Record<string, unknown>,
  status: number,
  refreshed?: { access_token: string; refresh_token: string; expires_in: number }
) {
  const res = NextResponse.json(body, { status })
  if (refreshed) {
    applyRefreshedSessionCookies(res, {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_in: refreshed.expires_in,
    })
  }
  return res
}

/**
 * POST /api/ai/voice
 * Multipart form: `audio` (Blob), `teamId` (string).
 * Auth (lite) + team scope + OpenAI speech-to-text only. Client POSTs `transcript` to /api/ai/chat.
 */
export async function POST(req: Request) {
  const tReceived = Date.now()
  const logPrefix = "[POST /api/ai/voice]"
  console.log(`${logPrefix} request received`, { at: new Date().toISOString() })

  const tAuth0 = Date.now()
  console.log(`${logPrefix} auth start (lite)`)
  const sessionResult = await getRequestUserLite()
  console.log(`${logPrefix} auth complete`, { ms: Date.now() - tAuth0, ok: Boolean(sessionResult?.user?.id) })

  if (!sessionResult?.user?.id) {
    console.warn(`${logPrefix} unauthorized`)
    return voiceJson({ error: "Unauthorized", code: "UNAUTHORIZED" satisfies CoachBVoiceErrorCode }, 401)
  }

  const refreshed = sessionResult.refreshedSession

  if (!isOpenAIConfigured()) {
    console.warn(`${logPrefix} OPENAI not configured`)
    return voiceJson(
      {
        error: "OPENAI_API_KEY is not configured",
        code: "OPENAI_NOT_CONFIGURED" satisfies CoachBVoiceErrorCode,
      },
      500,
      refreshed
    )
  }

  const tForm0 = Date.now()
  console.log(`${logPrefix} formData parse start`)
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    console.error(`${logPrefix} formData parse failed`, e)
    return voiceJson(
      {
        error: "Expected multipart form data",
        code: "BAD_MULTIPART" satisfies CoachBVoiceErrorCode,
      },
      400,
      refreshed
    )
  }
  console.log(`${logPrefix} formData parse complete`, { ms: Date.now() - tForm0 })

  const audio = formData.get("audio") ?? formData.get("file")
  const teamIdRaw = formData.get("teamId")

  if (!(audio instanceof Blob)) {
    console.warn(`${logPrefix} missing audio part`)
    return voiceJson({ error: "audio file is required", code: "MISSING_FILE" satisfies CoachBVoiceErrorCode }, 400, refreshed)
  }

  const filename =
    (audio instanceof File && audio.name?.trim()) || (audio as Blob & { name?: string }).name?.trim() || "recording.webm"
  const mime = (audio.type || "").toLowerCase() || "(empty)"
  console.log(`${logPrefix} audio part`, {
    size: audio.size,
    mime,
    filename,
  })

  if (audio.size === 0) {
    console.warn(`${logPrefix} zero-byte audio`)
    return voiceJson({ error: "audio file is empty", code: "EMPTY_FILE" satisfies CoachBVoiceErrorCode }, 400, refreshed)
  }

  if (audio.size > COACH_B_VOICE_MAX_BYTES) {
    console.warn(`${logPrefix} file too large`, { size: audio.size, max: COACH_B_VOICE_MAX_BYTES })
    return voiceJson(
      {
        error: `audio exceeds ${COACH_B_VOICE_MAX_BYTES} bytes`,
        code: "FILE_TOO_LARGE" satisfies CoachBVoiceErrorCode,
      },
      413,
      refreshed
    )
  }

  if (!isAllowedCoachBAudio(audio, filename)) {
    console.warn(`${logPrefix} unsupported mime`, { mime, filename })
    return voiceJson(
      {
        error: "Unsupported audio type",
        code: "UNSUPPORTED_AUDIO" satisfies CoachBVoiceErrorCode,
      },
      415,
      refreshed
    )
  }

  const teamId = typeof teamIdRaw === "string" && teamIdRaw.trim() ? teamIdRaw.trim() : ""
  if (!teamId) {
    console.warn(`${logPrefix} missing teamId`)
    return voiceJson({ error: "teamId is required", code: "MISSING_TEAM" satisfies CoachBVoiceErrorCode }, 400, refreshed)
  }

  const u = sessionResult.user
  const sessionUser: SessionUser = {
    id: u.id,
    email: u.email,
    role: u.role,
    teamId: u.teamId,
    isPlatformOwner: u.isPlatformOwner,
  }

  const tTeam0 = Date.now()
  console.log(`${logPrefix} team access start`, { teamId })
  try {
    const { membership } = await requireTeamAccessWithUser(teamId, sessionUser)
    console.log(`${logPrefix} team access ok`, { ms: Date.now() - tTeam0, role: membership.role })
    if (!canUseCoachB(membership.role as Role)) {
      return voiceJson(
        {
          error: "Coach B is only available to coaching and admin roles.",
          code: "FORBIDDEN" satisfies CoachBVoiceErrorCode,
        },
        403,
        refreshed
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`${logPrefix} team access failed`, { ms: Date.now() - tTeam0, msg })
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return voiceJson({ error: "You do not have access to this team.", code: "FORBIDDEN" }, 403, refreshed)
    }
    throw e
  }

  const tBuf0 = Date.now()
  const arrayBuffer = await audio.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log(`${logPrefix} buffer ready`, { ms: Date.now() - tBuf0, bytes: buffer.length })

  const tTr0 = Date.now()
  console.log(`${logPrefix} OpenAI transcription start`)
  const result = await transcribeCoachBAudio({ buffer, filename })
  console.log(`${logPrefix} OpenAI transcription end`, {
    ms: Date.now() - tTr0,
    ok: "transcript" in result,
  })

  if ("error" in result) {
    const status = result.code === "TRANSCRIPTION_TIMEOUT" ? 504 : result.code === "OPENAI_NOT_CONFIGURED" ? 500 : 502
    console.error(`${logPrefix} transcription error`, result)
    return voiceJson(
      { error: result.error, code: result.code },
      status,
      refreshed
    )
  }

  if (!result.transcript) {
    console.warn(`${logPrefix} empty transcript`, { userId: sessionUser.id, teamId })
    return voiceJson({ transcript: "", error: "No speech detected" }, 200, refreshed)
  }

  console.log(`${logPrefix} ok`, {
    totalMs: Date.now() - tReceived,
    userId: sessionUser.id,
    teamId,
    charCount: result.transcript.length,
  })
  console.log(`${logPrefix} transcript ready for client → /api/ai/chat`)

  return voiceJson({ transcript: result.transcript }, 200, refreshed)
}
