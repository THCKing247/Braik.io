/**
 * Compare depth chart assignment rows for equality (ignores entry `id` and embedded `player` objects).
 */

export type DepthChartComparable = {
  unit: string
  position: string
  string: number
  playerId: string | null
  formation?: string | null
  specialTeamType?: string | null
}

function normalizeRow(e: DepthChartComparable) {
  return {
    unit: e.unit,
    position: e.position,
    string: e.string,
    playerId: e.playerId,
    formation: e.formation ?? null,
    specialTeamType: e.specialTeamType ?? null,
  }
}

function sortKey(r: ReturnType<typeof normalizeRow>) {
  return [
    r.unit,
    r.position,
    String(r.string),
    r.formation ?? "",
    r.specialTeamType ?? "",
    r.playerId ?? "",
  ].join("\0")
}

/** True when assignment data matches (order-independent). */
export function depthChartAssignmentsEqual(
  a: DepthChartComparable[],
  b: DepthChartComparable[]
): boolean {
  if (a.length !== b.length) return false
  const na = a.map(normalizeRow).sort((x, y) => sortKey(x).localeCompare(sortKey(y)))
  const nb = b.map(normalizeRow).sort((x, y) => sortKey(x).localeCompare(sortKey(y)))
  return JSON.stringify(na) === JSON.stringify(nb)
}
