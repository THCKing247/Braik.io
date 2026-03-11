/**
 * Formation display helpers: formationId is the primary relationship.
 * Formation name is resolved from the formation record when available;
 * play.formation is used only for legacy/orphan plays (no formationId or no matching record).
 */

import type { PlayRecord, FormationRecord } from "@/types/playbook"

/**
 * Resolve display name for a play's formation.
 * Prefer formation record name when play.formationId matches; otherwise use play.formation (legacy).
 */
export function getPlayFormationDisplayName(
  play: Pick<PlayRecord, "formationId" | "formation">,
  formations: FormationRecord[] | null | undefined
): string {
  if (!formations?.length) return play.formation?.trim() || "—"
  if (play.formationId) {
    const f = formations.find((x) => x.id === play.formationId)
    if (f) return f.name
  }
  return play.formation?.trim() || "—"
}

/**
 * True when the play has no formation record link (formationId is null).
 * Such plays are "orphans" and appear under "Other"; display still uses play.formation for the name.
 */
export function isPlayFormationOrphan(play: Pick<PlayRecord, "formationId">): boolean {
  return play.formationId == null
}
