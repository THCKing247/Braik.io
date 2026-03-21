import type { SupabaseClient } from "@supabase/supabase-js"

export type AnalyticsTeamContext = {
  organization_id: string | null
  program_id: string | null
}

export async function resolveAnalyticsTeamContext(
  supabase: SupabaseClient,
  teamId: string | null | undefined
): Promise<AnalyticsTeamContext> {
  if (!teamId || typeof teamId !== "string") {
    return { organization_id: null, program_id: null }
  }
  const { data: team, error } = await supabase.from("teams").select("program_id").eq("id", teamId).maybeSingle()
  if (error || !team) {
    return { organization_id: null, program_id: null }
  }
  const programId = (team as { program_id?: string | null }).program_id ?? null
  if (!programId) {
    return { organization_id: null, program_id: null }
  }
  const { data: prog } = await supabase.from("programs").select("organization_id").eq("id", programId).maybeSingle()
  const organizationId = (prog as { organization_id?: string | null } | null)?.organization_id ?? null
  return { organization_id: organizationId, program_id: programId }
}
