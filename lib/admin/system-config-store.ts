import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type ConfigScope = "future_only" | "all" | "selective"

export interface SystemConfigRow {
  id: string
  key: string
  value_json: unknown
  version: number
  applied_scope: ConfigScope
  applied_team_ids: string[] | null
  applied_at: string
  applied_by: string
}

export async function listSystemConfig(limit = 200): Promise<SystemConfigRow[]> {
  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("system_config")
    .select("id, key, value_json, version, applied_scope, applied_team_ids, applied_at, applied_by")
    .order("applied_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    key: r.key,
    value_json: r.value_json,
    version: r.version,
    applied_scope: r.applied_scope as ConfigScope,
    applied_team_ids: r.applied_team_ids,
    applied_at: String(r.applied_at),
    applied_by: String(r.applied_by),
  }))
}

export async function appendSystemConfigVersion(input: {
  key: string
  valueJson: unknown
  appliedScope: ConfigScope
  appliedTeamIds?: string[] | null
  appliedBy: string
}): Promise<SystemConfigRow> {
  const supabase = getSupabaseServer()

  const { data: existing } = await supabase
    .from("system_config")
    .select("version")
    .eq("key", input.key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (existing?.version ?? 0) + 1
  const { data: inserted, error } = await supabase
    .from("system_config")
    .insert({
      key: input.key,
      value_json: input.valueJson ?? {},
      version: nextVersion,
      applied_scope: input.appliedScope,
      applied_team_ids: input.appliedScope === "selective" ? input.appliedTeamIds : null,
      applied_by: input.appliedBy,
    })
    .select()
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to append system config")
  }

  return {
    id: String(inserted.id),
    key: inserted.key,
    value_json: inserted.value_json,
    version: inserted.version,
    applied_scope: inserted.applied_scope as ConfigScope,
    applied_team_ids: inserted.applied_team_ids,
    applied_at: String(inserted.applied_at),
    applied_by: String(inserted.applied_by),
  }
}
