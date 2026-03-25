import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { computeReadiness } from "@/lib/readiness"
import { activeDocumentCategoriesForReadiness } from "@/lib/readiness-documents"

export type TeamReadinessSummary = {
  total: number
  readyCount: number
  incompleteCount: number
  missingPhysicalCount: number
  missingWaiverCount: number
  notAccountLinkedCount: number
  incompleteProfileCount: number
  noEquipmentCount: number
  eligibilityMissingCount: number
  noGuardiansCount: number
}

export type PlayerReadinessItem = {
  playerId: string
  firstName: string
  lastName: string
  ready: boolean
  profileComplete: boolean
  physicalOnFile: boolean
  waiverOnFile: boolean
  accountLinked: boolean
  requiredDocsComplete: boolean
  equipmentAssigned: boolean
  assignedEquipmentCount: number
  eligibilityStatus: string | null
  hasGuardians: boolean
  missingItems: string[]
}

const EMPTY_SUMMARY: TeamReadinessSummary = {
  total: 0,
  readyCount: 0,
  incompleteCount: 0,
  missingPhysicalCount: 0,
  missingWaiverCount: 0,
  notAccountLinkedCount: 0,
  incompleteProfileCount: 0,
  noEquipmentCount: 0,
  eligibilityMissingCount: 0,
  noGuardiansCount: 0,
}

/**
 * Team readiness from Supabase. summaryOnly skips per-player JSON (dashboard card).
 * Called from GET handler after auth; may be wrapped in unstable_cache.
 */
export async function computeTeamReadinessPayload(
  teamId: string,
  summaryOnly: boolean
): Promise<{ summary: TeamReadinessSummary; players?: PlayerReadinessItem[] }> {
  const supabase = getSupabaseServer()

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, email, player_phone, parent_guardian_contact, eligibility_status, user_id"
    )
    .eq("team_id", teamId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (playersErr || !players?.length) {
    return summaryOnly
      ? { summary: { ...EMPTY_SUMMARY } }
      : { summary: { ...EMPTY_SUMMARY }, players: [] }
  }

  const playerIds = players.map((p) => (p as { id: string }).id)

  const [docsRes, equipmentCounts, guardianCounts] = await Promise.all([
    supabase
      .from("player_documents")
      .select("player_id, category, document_type, deleted_at, expires_at")
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .in("player_id", playerIds),
    supabase
      .from("inventory_items")
      .select("assigned_to_player_id")
      .eq("team_id", teamId)
      .not("assigned_to_player_id", "is", null),
    supabase.from("guardian_links").select("player_id").in("player_id", playerIds),
  ])

  const docsByPlayer = new Map<string, string[]>()
  const byPlayerRaw = new Map<
    string,
    Array<{
      category?: string | null
      document_type?: string | null
      deleted_at?: string | null
      expires_at?: string | null
    }>
  >()
  for (const d of docsRes.data ?? []) {
    const pid = (d as { player_id: string }).player_id
    const list = byPlayerRaw.get(pid) ?? []
    list.push(
      d as {
        category?: string | null
        document_type?: string | null
        deleted_at?: string | null
        expires_at?: string | null
      }
    )
    byPlayerRaw.set(pid, list)
  }
  byPlayerRaw.forEach((rows, pid) => {
    docsByPlayer.set(pid, activeDocumentCategoriesForReadiness(rows))
  })

  const equipmentByPlayer = new Map<string, number>()
  for (const e of equipmentCounts.data ?? []) {
    const pid = (e as { assigned_to_player_id: string }).assigned_to_player_id
    equipmentByPlayer.set(pid, (equipmentByPlayer.get(pid) ?? 0) + 1)
  }

  const guardiansByPlayer = new Set<string>()
  for (const g of guardianCounts.data ?? []) {
    guardiansByPlayer.add((g as { player_id: string }).player_id)
  }

  const playerReadinessList: PlayerReadinessItem[] = []

  let readyCount = 0
  let missingPhysicalCount = 0
  let missingWaiverCount = 0
  let notAccountLinkedCount = 0
  let incompleteProfileCount = 0
  let noEquipmentCount = 0
  let eligibilityMissingCount = 0
  let noGuardiansCount = 0

  for (const p of players) {
    const row = p as {
      id: string
      first_name: string | null
      last_name: string | null
      email: string | null
      player_phone: string | null
      parent_guardian_contact: string | null
      eligibility_status: string | null
      user_id: string | null
    }
    const accountLinked = Boolean(row.user_id)
    const hasName = Boolean(row.first_name?.trim()) && Boolean(row.last_name?.trim())
    const hasContact =
      Boolean(row.player_phone?.trim()) ||
      Boolean(row.email?.trim()) ||
      Boolean(row.parent_guardian_contact?.trim())
    const categories = docsByPlayer.get(row.id) ?? []
    const assignedEquipmentCount = equipmentByPlayer.get(row.id) ?? 0
    const hasGuardians = guardiansByPlayer.has(row.id)

    const result = computeReadiness(
      {
        hasName,
        hasContact,
        documentCategories: categories,
        eligibilityStatus: row.eligibility_status ?? null,
        assignedEquipmentCount,
      },
      { omitMissingItems: summaryOnly }
    )

    if (result.ready) readyCount++
    if (!result.physicalOnFile) missingPhysicalCount++
    if (!result.waiverOnFile) missingWaiverCount++
    if (!accountLinked) notAccountLinkedCount++
    if (!result.profileComplete) incompleteProfileCount++
    if (!result.equipmentAssigned) noEquipmentCount++
    if (!result.eligibilityStatus?.trim()) eligibilityMissingCount++
    if (!hasGuardians) noGuardiansCount++

    if (!summaryOnly) {
      const missingItems = [...result.missingItems, ...(!accountLinked ? ["Account not linked"] : [])]
      playerReadinessList.push({
        playerId: row.id,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        ready: result.ready,
        profileComplete: result.profileComplete,
        physicalOnFile: result.physicalOnFile,
        waiverOnFile: result.waiverOnFile,
        accountLinked,
        requiredDocsComplete: result.requiredDocsComplete,
        equipmentAssigned: result.equipmentAssigned,
        assignedEquipmentCount: result.assignedEquipmentCount,
        eligibilityStatus: result.eligibilityStatus,
        hasGuardians,
        missingItems,
      })
    }
  }

  const total = players.length
  const incompleteCount = total - readyCount

  const summary: TeamReadinessSummary = {
    total,
    readyCount,
    incompleteCount,
    missingPhysicalCount,
    missingWaiverCount,
    notAccountLinkedCount,
    incompleteProfileCount,
    noEquipmentCount,
    eligibilityMissingCount,
    noGuardiansCount,
  }

  if (summaryOnly) {
    return { summary }
  }
  return { summary, players: playerReadinessList }
}
