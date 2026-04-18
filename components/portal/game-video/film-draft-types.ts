/** Client-only draft before POST to clips API */
export type FilmDraftClip = {
  id: string
  startMs: number
  endMs: number
  /** Display label e.g. Clip 1 */
  slotLabel: string
  /** Coach-editable title; defaults to slotLabel until changed */
  titleDraft: string
  description: string
  /** Mirrors quick tag pill selection (serialized for draft round-trip). */
  quickTagKeys: string[]
  clipTagsFree: string
  categories: {
    playType: string
    situation: string
    personnel: string
    outcome: string
  }
  attachedPlayerIds: string[]
}

export type MarkPhase = "idle" | "await_end"

export function nextDraftSlotLabel(index: number): string {
  return `Clip ${index + 1}`
}
