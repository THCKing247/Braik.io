import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { computeReadiness, resolveRequiredDocCategoriesFromStored } from "@/lib/readiness"
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

const GUARDIAN_IN_CHUNK = 250

async function loadRequiredDocumentCategories(teamId: string): Promise<string[]> {
  const supabase = getSupabaseServer()
  const { data } = await supabase.from("teams").select("roster_template").eq("id", teamId).maybeSingle()
  const raw = (data as { roster_template?: { documentReadinessRequired?: Record<string, boolean> } } | null)
    ?.roster_template?.documentReadinessRequired
  return resolveRequiredDocCategoriesFromStored(raw)
}

async function guardianPlayerIdSet(
  supabase: ReturnType<typeof getSupabaseServer>,
  playerIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < playerIds.length; i += GUARDIAN_IN_CHUNK) {
    const slice = playerIds.slice(i, i + GUARDIAN_IN_CHUNK)
    const { data } = await supabase.from("guardian_links").select("player_id").in("player_id", slice)
    for (const g of data ?? []) {
      out.add((g as { player_id: string }).player_id)
    }
  }
  return out
}

/**
 * Dashboard summary: one DB round-trip, no document/equipment/guardian row hydration.
 * Matches computeReadiness "ready" = profileComplete && requiredDocsComplete (physical + waiver).
 * Breakdown fields in TeamReadinessSummary are set to 0 (not computed on this path).
 */
async function computeSummaryMinimalRpc(teamId: string): Promise<TeamReadinessSummary | null> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase.rpc("team_readiness_summary_minimal", { p_team_id: teamId })
  if (error || data == null || typeof data !== "object") {
    console.warn("[computeTeamReadiness] team_readiness_summary_minimal RPC unavailable or failed", error)
    return null
  }
  const row = data as { total?: unknown; ready_count?: unknown }
  const total = Math.max(0, Number(row.total) || 0)
  const readyCount = Math.min(total, Math.max(0, Number(row.ready_count) || 0))
  return {
    ...EMPTY_SUMMARY,
    total,
    readyCount,
    incompleteCount: total - readyCount,
  }
}

type PlayerRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  player_phone: string | null
  parent_guardian_contact: string | null
  eligibility_status: string | null
  user_id: string | null
}

async function loadReadinessContext(teamId: string): Promise<{
  players: PlayerRow[]
  docsByPlayer: Map<string, string[]>
  equipmentByPlayer: Map<string, number>
  guardiansByPlayer: Set<string>
} | null> {
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
    return null
  }

  const typedPlayers = players as PlayerRow[]
  const playerIds = typedPlayers.map((p) => p.id)

  const [docsRes, equipmentRes, guardiansByPlayer] = await Promise.all([
    supabase
      .from("player_documents")
      .select("player_id, category, document_type, expires_at")
      .eq("team_id", teamId)
      .is("deleted_at", null),
    supabase
      .from("inventory_items")
      .select("assigned_to_player_id")
      .eq("team_id", teamId)
      .not("assigned_to_player_id", "is", null),
    guardianPlayerIdSet(supabase, playerIds),
  ])

  const byPlayerRaw = new Map<
    string,
    Array<{ category?: string | null; document_type?: string | null; expires_at?: string | null }>
  >()
  for (const d of docsRes.data ?? []) {
    const pid = (d as { player_id: string }).player_id
    const list = byPlayerRaw.get(pid) ?? []
    list.push(
      d as { category?: string | null; document_type?: string | null; expires_at?: string | null }
    )
    byPlayerRaw.set(pid, list)
  }

  const docsByPlayer = new Map<string, string[]>()
  byPlayerRaw.forEach((rows, pid) => {
    docsByPlayer.set(pid, activeDocumentCategoriesForReadiness(rows))
  })

  const equipmentByPlayer = new Map<string, number>()
  for (const e of equipmentRes.data ?? []) {
    const pid = (e as { assigned_to_player_id: string }).assigned_to_player_id
    equipmentByPlayer.set(pid, (equipmentByPlayer.get(pid) ?? 0) + 1)
  }

  return { players: typedPlayers, docsByPlayer, equipmentByPlayer, guardiansByPlayer }
}

function aggregateReadiness(
  players: PlayerRow[],
  docsByPlayer: Map<string, string[]>,
  equipmentByPlayer: Map<string, number>,
  guardiansByPlayer: Set<string>,
  buildList: boolean,
  requiredDocCategories: string[]
): { summary: TeamReadinessSummary; players?: PlayerReadinessItem[] } {
  const playerReadinessList: PlayerReadinessItem[] = []

  let readyCount = 0
  let missingPhysicalCount = 0
  let missingWaiverCount = 0
  let notAccountLinkedCount = 0
  let incompleteProfileCount = 0
  let noEquipmentCount = 0
  let eligibilityMissingCount = 0
  let noGuardiansCount = 0

  for (const row of players) {
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
      { omitMissingItems: !buildList, requiredDocCategories }
    )

    if (result.ready) readyCount++
    if (requiredDocCategories.includes("physical") && !result.physicalOnFile) missingPhysicalCount++
    if (requiredDocCategories.includes("waiver") && !result.waiverOnFile) missingWaiverCount++
    if (!accountLinked) notAccountLinkedCount++
    if (!result.profileComplete) incompleteProfileCount++
    if (!result.equipmentAssigned) noEquipmentCount++
    if (!result.eligibilityStatus?.trim()) eligibilityMissingCount++
    if (!hasGuardians) noGuardiansCount++

    if (buildList) {
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

  if (buildList) {
    return { summary, players: playerReadinessList }
  }
  return { summary }
}

/** Fallback when RPC is missing: same queries as full path but no per-player JSON. */
async function computeSummaryHeavyFallback(teamId: string): Promise<{ summary: TeamReadinessSummary }> {
  const ctx = await loadReadinessContext(teamId)
  if (!ctx) {
    return { summary: { ...EMPTY_SUMMARY } }
  }
  const requiredDocCategories = await loadRequiredDocumentCategories(teamId)
  return aggregateReadiness(
    ctx.players,
    ctx.docsByPlayer,
    ctx.equipmentByPlayer,
    ctx.guardiansByPlayer,
    false,
    requiredDocCategories
  )
}

export type TeamReadinessRequestOptions = {
  /** Paginate "Needs attention" or full roster checklist table (server-backed). */
  section?: "attention" | "checklist"
  page?: number
  limit?: number
  /** Case-insensitive search on first + last name (pagination tables). */
  q?: string
  /** Omit long missing-items strings; keeps roster filter + client payloads smaller. */
  playerFlagsOnly?: boolean
}

function filterAttentionPlayers(list: PlayerReadinessItem[]): PlayerReadinessItem[] {
  return list.filter((p) => !p.ready || p.missingItems.length > 0)
}

function filterByNameQuery(list: PlayerReadinessItem[], q: string): PlayerReadinessItem[] {
  const s = q.trim().toLowerCase()
  if (!s) return list
  return list.filter((p) => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase()
    return name.includes(s)
  })
}

/**
 * Team readiness from Supabase.
 * - summaryOnly: DB aggregation RPC (fast); fallback aggregates in memory without building player rows.
 * - full: loads team-scoped documents/inventory + chunked guardian IN; builds per-player list.
 * - section/page/limit/q: same full compute, then slice one page (for Needs attention or Roster checklist).
 * - playerFlagsOnly: full row shape but missingItems cleared (smaller JSON for roster filters).
 */
export async function computeTeamReadinessPayload(
  teamId: string,
  summaryOnly: boolean,
  opts?: TeamReadinessRequestOptions
): Promise<
  | { summary: TeamReadinessSummary; players?: PlayerReadinessItem[] }
  | {
      summary: TeamReadinessSummary
      players: PlayerReadinessItem[]
      total: number
      page: number
      pageSize: number
      section: "attention" | "checklist"
    }
> {
  if (summaryOnly) {
    const rpcSummary = await computeSummaryMinimalRpc(teamId)
    if (rpcSummary) {
      return { summary: rpcSummary }
    }
    return computeSummaryHeavyFallback(teamId)
  }

  const ctx = await loadReadinessContext(teamId)
  if (!ctx) {
    if (opts?.section) {
      return {
        summary: { ...EMPTY_SUMMARY },
        players: [],
        total: 0,
        page: Math.max(1, opts.page ?? 1),
        pageSize: Math.min(100, Math.max(1, opts.limit ?? 10)),
        section: opts.section,
      }
    }
    return { summary: { ...EMPTY_SUMMARY }, players: [] }
  }
  const requiredDocCategories = await loadRequiredDocumentCategories(teamId)
  const aggregated = aggregateReadiness(
    ctx.players,
    ctx.docsByPlayer,
    ctx.equipmentByPlayer,
    ctx.guardiansByPlayer,
    true,
    requiredDocCategories
  )
  let players = aggregated.players ?? []

  if (opts?.playerFlagsOnly) {
    players = players.map((p) => ({ ...p, missingItems: [] as string[] }))
  }

  if (opts?.section) {
    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, opts.limit ?? 10))
    let filtered =
      opts.section === "attention" ? filterAttentionPlayers(players) : [...players]
    filtered = filterByNameQuery(filtered, opts.q ?? "")
    const total = filtered.length
    const start = (page - 1) * pageSize
    const slice = filtered.slice(start, start + pageSize)
    return {
      summary: aggregated.summary,
      players: slice,
      total,
      page,
      pageSize,
      section: opts.section,
    }
  }

  return aggregated
}
