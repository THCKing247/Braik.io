import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { computeReadiness } from "@/lib/readiness"

/**
 * GET /api/teams/[teamId]/readiness
 * Team-wide readiness summary. Coach only. Reuses same logic as per-player readiness.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view team readiness." }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    const { data: players, error: playersErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, email, player_phone, parent_guardian_contact, eligibility_status")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (playersErr || !players?.length) {
      return NextResponse.json({
        summary: {
          total: 0,
          readyCount: 0,
          incompleteCount: 0,
          missingPhysicalCount: 0,
          missingWaiverCount: 0,
          incompleteProfileCount: 0,
          noEquipmentCount: 0,
          eligibilityMissingCount: 0,
          noGuardiansCount: 0,
        },
        players: [],
      })
    }

    const playerIds = players.map((p) => (p as { id: string }).id)

    const [docsRes, equipmentCounts, guardianCounts] = await Promise.all([
      supabase
        .from("player_documents")
        .select("player_id, category")
        .eq("team_id", teamId)
        .in("player_id", playerIds),
      supabase
        .from("inventory_items")
        .select("assigned_to_player_id")
        .eq("team_id", teamId)
        .not("assigned_to_player_id", "is", null),
      supabase
        .from("guardian_links")
        .select("player_id")
        .in("player_id", playerIds),
    ])

    const docsByPlayer = new Map<string, string[]>()
    ;(docsRes.data ?? []).forEach((d) => {
      const pid = (d as { player_id: string }).player_id
      const cat = (d as { category: string }).category
      const list = docsByPlayer.get(pid) ?? []
      if (!list.includes(cat)) list.push(cat)
      docsByPlayer.set(pid, list)
    })

    const equipmentByPlayer = new Map<string, number>()
    ;(equipmentCounts.data ?? []).forEach((e) => {
      const pid = (e as { assigned_to_player_id: string }).assigned_to_player_id
      equipmentByPlayer.set(pid, (equipmentByPlayer.get(pid) ?? 0) + 1)
    })

    const guardiansByPlayer = new Set<string>()
    ;(guardianCounts.data ?? []).forEach((g) => {
      guardiansByPlayer.add((g as { player_id: string }).player_id)
    })

    const playerReadinessList: Array<{
      playerId: string
      firstName: string
      lastName: string
      ready: boolean
      profileComplete: boolean
      physicalOnFile: boolean
      waiverOnFile: boolean
      requiredDocsComplete: boolean
      equipmentAssigned: boolean
      assignedEquipmentCount: number
      eligibilityStatus: string | null
      hasGuardians: boolean
      missingItems: string[]
    }> = []

    let readyCount = 0
    let missingPhysicalCount = 0
    let missingWaiverCount = 0
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
      }
      const hasName = Boolean(row.first_name?.trim()) && Boolean(row.last_name?.trim())
      const hasContact =
        Boolean(row.player_phone?.trim()) ||
        Boolean(row.email?.trim()) ||
        Boolean(row.parent_guardian_contact?.trim())
      const categories = docsByPlayer.get(row.id) ?? []
      const assignedEquipmentCount = equipmentByPlayer.get(row.id) ?? 0
      const hasGuardians = guardiansByPlayer.has(row.id)

      const result = computeReadiness({
        hasName,
        hasContact,
        documentCategories: categories,
        eligibilityStatus: row.eligibility_status ?? null,
        assignedEquipmentCount,
      })

      if (result.ready) readyCount++
      if (!result.physicalOnFile) missingPhysicalCount++
      if (!result.waiverOnFile) missingWaiverCount++
      if (!result.profileComplete) incompleteProfileCount++
      if (!result.equipmentAssigned) noEquipmentCount++
      if (!result.eligibilityStatus?.trim()) eligibilityMissingCount++
      if (!hasGuardians) noGuardiansCount++

      playerReadinessList.push({
        playerId: row.id,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        ready: result.ready,
        profileComplete: result.profileComplete,
        physicalOnFile: result.physicalOnFile,
        waiverOnFile: result.waiverOnFile,
        requiredDocsComplete: result.requiredDocsComplete,
        equipmentAssigned: result.equipmentAssigned,
        assignedEquipmentCount: result.assignedEquipmentCount,
        eligibilityStatus: result.eligibilityStatus,
        hasGuardians,
        missingItems: result.missingItems,
      })
    }

    const total = players.length
    const incompleteCount = total - readyCount

    return NextResponse.json({
      summary: {
        total,
        readyCount,
        incompleteCount,
        missingPhysicalCount,
        missingWaiverCount,
        incompleteProfileCount,
        noEquipmentCount,
        eligibilityMissingCount,
        noGuardiansCount,
      },
      players: playerReadinessList,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../readiness]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
