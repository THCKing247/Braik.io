import type { ContextModuleInput, InjuryContext } from "./types"
import type { InjuryRowRelation } from "./shared"
import { parseInjuryPlayerName } from "./shared"

export async function getInjuryContext(input: ContextModuleInput): Promise<InjuryContext[] | null> {
  const { teamId, supabase } = input
  try {
    const { data: rows, error } = await supabase
      .from("player_injuries")
      .select(
        "player_id, injury_reason, injury_date, expected_return_date, status, notes, severity, exempt_from_practice, players(first_name, last_name)"
      )
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("injury_date", { ascending: false })
    if (error) {
      console.error("[braik-ai] injuries fetch failed", { teamId, message: error.message })
      return null
    }
    let practiceMap = new Map<string, string>()
    try {
      const { data: ppRows } = await supabase
        .from("practice_participation")
        .select("player_id, participation_status, occurred_at")
        .eq("team_id", teamId)
        .order("occurred_at", { ascending: false })
        .limit(150)
      if (ppRows?.length) {
        const seen = new Set<string>()
        for (const r of ppRows as Array<{ player_id: string; participation_status: string }>) {
          if (!seen.has(r.player_id)) {
            seen.add(r.player_id)
            practiceMap.set(r.player_id, r.participation_status ?? "unknown")
          }
        }
      }
    } catch {
      practiceMap = new Map()
    }
    const result: InjuryContext[] = (rows ?? []).map((i) => {
      const row = i as unknown as InjuryRowRelation & {
        injury_date?: string
        severity?: string | null
        exempt_from_practice?: boolean | null
      }
      const status = row.status ?? "active"
      const availability = status === "active" ? "out" : "returned"
      const exempt = row.exempt_from_practice === true
      return {
        playerId: row.player_id,
        fullName: parseInjuryPlayerName(row),
        status,
        availability,
        practiceStatus: exempt ? "exempt_from_practice" : null,
        bodyPart: null,
        notes: row.notes ?? null,
        expectedReturn: row.expected_return_date,
        reason: row.injury_reason,
        injuryDate: row.injury_date ?? null,
        severity: row.severity ?? null,
        exemptFromPractice: exempt,
        practiceParticipation: practiceMap.get(row.player_id) ?? undefined,
      }
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getInjuryContext failed", { teamId, message: msg })
    return null
  }
}
