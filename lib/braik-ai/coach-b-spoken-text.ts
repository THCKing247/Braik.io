/**
 * Voice-optimized line for TTS when the API does not set spokenText.
 * One short sentence; avoids reading walls of text.
 */
export function deriveDefaultSpokenText(fullText: string, opts?: { maxChars?: number }): string {
  const max = opts?.maxChars ?? 280
  const t = fullText.replace(/\s+/g, " ").trim()
  if (!t) return ""
  const first = t.split(/(?<=[.!?])\s+/)[0]?.trim() ?? t
  const candidate = first.length >= 40 ? first : t.split("\n")[0]?.trim() ?? first
  if (candidate.length <= max) return candidate
  const cut = candidate.slice(0, max - 1).trimEnd()
  const sp = cut.lastIndexOf(" ")
  return `${sp > 60 ? cut.slice(0, sp) : cut}…`
}
