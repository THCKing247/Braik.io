import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function requireTeamServiceWriteAccess(teamId: string): Promise<void> {
  const supabase = getSupabaseServer()
  const { data: team } = await supabase
    .from("teams")
    .select("id, service_status")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
    throw new Error("Team not found")
  }

  const status = (team as { service_status?: string }).service_status ?? team.service_status
  if (status === "SUSPENDED") {
    throw new Error("Team is suspended. Editing is disabled until billing is restored.")
  }
}
