import type { SupabaseClient } from "@supabase/supabase-js"

export type TeamScopeIds = {
  teamId: string
  programId: string | null
  organizationId: string | null
}

export async function resolveTeamOrgProgramIds(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamScopeIds | null> {
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, program_id")
    .eq("id", teamId)
    .maybeSingle()

  if (error || !team) return null

  const programId = (team as { program_id?: string | null }).program_id ?? null
  let organizationId: string | null = null

  if (programId) {
    const { data: prog } = await supabase.from("programs").select("organization_id").eq("id", programId).maybeSingle()
    organizationId = (prog as { organization_id?: string | null } | null)?.organization_id ?? null
  }

  return { teamId, programId, organizationId }
}
