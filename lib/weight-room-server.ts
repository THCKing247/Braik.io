import type { SupabaseClient } from "@supabase/supabase-js"

const LIFT_TO_COLUMN: Record<string, keyof PlayerMaxColumns> = {
  BENCH: "max_bench_lbs",
  SQUAT: "max_squat_lbs",
  CLEAN: "max_power_clean_lbs",
  DEADLIFT: "max_deadlift_lbs",
}

export type PlayerMaxColumns = {
  max_bench_lbs: number | null
  max_squat_lbs: number | null
  max_power_clean_lbs: number | null
  max_deadlift_lbs: number | null
}

/** Recompute current max per lift from player_maxes and write to players row. */
export async function syncPlayerMaxColumnsToProfile(
  supabase: SupabaseClient,
  teamId: string,
  playerId: string
): Promise<PlayerMaxColumns> {
  const lifts = ["BENCH", "SQUAT", "CLEAN", "DEADLIFT"] as const
  const updates: Record<string, number | null> = {
    max_bench_lbs: null,
    max_squat_lbs: null,
    max_power_clean_lbs: null,
    max_deadlift_lbs: null,
  }

  for (const lift of lifts) {
    const { data: row } = await supabase
      .from("player_maxes")
      .select("weight_lbs, logged_date, created_at")
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .eq("lift_type", lift)
      .order("logged_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const col = LIFT_TO_COLUMN[lift]
    updates[col] = row?.weight_lbs ?? null
  }

  await supabase
    .from("players")
    .update({
      max_bench_lbs: updates.max_bench_lbs,
      max_squat_lbs: updates.max_squat_lbs,
      max_power_clean_lbs: updates.max_power_clean_lbs,
      max_deadlift_lbs: updates.max_deadlift_lbs,
    })
    .eq("id", playerId)
    .eq("team_id", teamId)

  return {
    max_bench_lbs: updates.max_bench_lbs,
    max_squat_lbs: updates.max_squat_lbs,
    max_power_clean_lbs: updates.max_power_clean_lbs,
    max_deadlift_lbs: updates.max_deadlift_lbs,
  }
}

/** Bench + Squat + Clean latest totals for 1000 lb club. */
export async function getThreeLiftTotal(
  supabase: SupabaseClient,
  teamId: string,
  playerId: string
): Promise<number> {
  let sum = 0
  for (const lift of ["BENCH", "SQUAT", "CLEAN"] as const) {
    const { data: row } = await supabase
      .from("player_maxes")
      .select("weight_lbs")
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .eq("lift_type", lift)
      .order("logged_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    sum += row?.weight_lbs ?? 0
  }
  return sum
}

export async function getHeadCoachUserIds(supabase: SupabaseClient, teamId: string): Promise<string[]> {
  const { data } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)
    .eq("role", "HEAD_COACH")
  return (data ?? []).map((r) => r.user_id).filter(Boolean) as string[]
}
