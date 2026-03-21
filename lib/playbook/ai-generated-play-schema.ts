/**
 * Renderer-agnostic shapes for AI-generated football plays.
 * Aligns conceptually with playbook canvas points (yard space + optional screen pixels).
 * TODO: Wire import path from Coach B / suggest-play into playbook-builder when backend returns this shape.
 */

export type AiRoutePointYards = {
  xYards: number
  yYards: number
  t?: number
}

/** One receiver / skill route with optional depth metadata for coaching and AI prompts. */
export type AiSuggestedRoute = {
  role: string
  /** Human label, e.g. "Dig", "Wheel" */
  concept: string
  /** Optional: primary stem depth in yards downfield (coaching convention; not strict NFL charting). */
  yardDepth?: number
  /** Optional polyline in field yard coordinates for rendering pipelines. */
  waypointsYards?: AiRoutePointYards[]
}

/** Minimal play shell for turning suggestions into editable plays (formation TBD in editor). */
export type AiGeneratedPlayDescriptor = {
  name: string
  side: "offense" | "defense" | "special_teams"
  playType?: string | null
  tags?: string[]
  routes: AiSuggestedRoute[]
  /** Freeform notes for staff review — never auto-execute without human confirmation. */
  coachingNotes?: string
}
