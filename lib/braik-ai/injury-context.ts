import type { ContextModuleInput, InjuryContext } from "./types"
import type { InjuryRowRelation } from "./shared"
import { parseInjuryPlayerName } from "./shared"

export async function getInjuryContext(input: ContextModuleInput): Promise<InjuryContext[] | null> {
  const { teamId, supabase } = input
  try {
    const { data: rows, error } = await supabase
      .from("player_injuries")
      .select("player_id, injury_reason, expected_return_date, status, notes, players(first_name, last_name)")
      .eq("team_id", teamId)
      .order("injury_date", { ascending: false })
    if (error) {
      console.error("[braik-ai] injuries fetch failed", { teamId, message: error.message })
      return null
    }
    const result: InjuryContext[] = (rows ?? []).map((i) => {
      const row = i as unknown as InjuryRowRelation
      const status = row.status ?? "active"
      const availability = status === "active" ? "out" : "returned"
      return {
        playerId: row.player_id,
        fullName: parseInjuryPlayerName(row),
        status,
        availability,
        practiceStatus: null,
        bodyPart: null,
        notes: row.notes ?? null,
        expectedReturn: row.expected_return_date,
        reason: row.injury_reason,
      }
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getInjuryContext failed", { teamId, message: msg })
    return null
  }
}
