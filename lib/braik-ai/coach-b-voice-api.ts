/**
 * Shared constants for POST /api/ai/voice — safe to import from client components.
 */
export type CoachBVoiceErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "OPENAI_NOT_CONFIGURED"
  | "BAD_MULTIPART"
  | "MISSING_FILE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_AUDIO"
  | "MISSING_TEAM"
  | "TRANSCRIPTION_FAILED"
  | "TRANSCRIPTION_TIMEOUT"

export const COACH_B_VOICE_MAX_BYTES = 10 * 1024 * 1024

const ALL_CODES: Record<CoachBVoiceErrorCode, true> = {
  UNAUTHORIZED: true,
  FORBIDDEN: true,
  OPENAI_NOT_CONFIGURED: true,
  BAD_MULTIPART: true,
  MISSING_FILE: true,
  EMPTY_FILE: true,
  FILE_TOO_LARGE: true,
  UNSUPPORTED_AUDIO: true,
  MISSING_TEAM: true,
  TRANSCRIPTION_FAILED: true,
  TRANSCRIPTION_TIMEOUT: true,
}

export function isCoachBVoiceErrorCode(s: string): s is CoachBVoiceErrorCode {
  return s in ALL_CODES
}

/** Map API response + HTTP status to a user-visible chat line (widget). */
export function resolveCoachBVoiceClientMessage(
  status: number,
  data: { code?: unknown; error?: unknown }
): string {
  const code = typeof data.code === "string" && isCoachBVoiceErrorCode(data.code) ? data.code : null
  if (code) return coachBVoiceErrorMessage(code)
  if (status === 504) return coachBVoiceErrorMessage("TRANSCRIPTION_TIMEOUT")
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim()
  return "Voice request failed. Please try again."
}

export function coachBVoiceErrorMessage(code: CoachBVoiceErrorCode): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "Sign in again, then try voice."
    case "FORBIDDEN":
      return "You don’t have access to Coach B for this team."
    case "OPENAI_NOT_CONFIGURED":
      return "Voice isn’t available on the server right now."
    case "BAD_MULTIPART":
      return "Couldn’t read the recording. Try again or type your message."
    case "MISSING_FILE":
      return "No audio was uploaded. Try recording again."
    case "EMPTY_FILE":
      return "That recording was empty. Try again."
    case "FILE_TOO_LARGE":
      return "Recording is too large. Try a shorter clip."
    case "UNSUPPORTED_AUDIO":
      return "This audio format isn’t supported. Try again or type your message."
    case "MISSING_TEAM":
      return "Team is required for voice. Open Coach B from a team dashboard."
    case "TRANSCRIPTION_FAILED":
      return "Couldn’t transcribe that. Try again or type your message."
    case "TRANSCRIPTION_TIMEOUT":
      return "Transcription took too long. Try a shorter clip or type your message."
    default:
      return "Something went wrong with voice. Please try again."
  }
}
