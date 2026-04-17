import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramStaffAdmin, MembershipLookupError } from "@/lib/auth/rbac"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { sumProgramTeamsUsedBytes, getTeamRollup } from "@/lib/video/quota"

export const runtime = "nodejs"

/**
 * Program-level video storage view for AD / head coach admins.
 * Aggregates rollups across teams when shared program pool applies.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { programId } = await params
    await requireProgramStaffAdmin(programId)

    const supabase = getSupabaseServer()

    const { data: teams, error: tErr } = await supabase.from("teams").select("id, name").eq("program_id", programId)
    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    const teamList = teams ?? []
    const perTeam: Array<{
      teamId: string
      teamName: string | null
      usedBytes: number
      videoCount: number
      clipCount: number
      capBytes: number
      tier: string
      sharedScope: string
    }> = []

    for (const t of teamList) {
      const tid = (t as { id: string }).id
      const ent = await resolveEffectiveVideoEntitlements(supabase, tid)
      const rollup = await getTeamRollup(supabase, tid)
      perTeam.push({
        teamId: tid,
        teamName: (t as { name?: string | null }).name ?? null,
        usedBytes: rollup.usedBytes,
        videoCount: rollup.videoCount,
        clipCount: rollup.clipCount,
        capBytes: ent?.storageCapBytes ?? 0,
        tier: ent?.tier ?? "starter",
        sharedScope: ent?.sharedStorageScope ?? "team",
      })
    }

    const programPooledBytes = await sumProgramTeamsUsedBytes(supabase, programId)

    const { data: progSettings } = await supabase
      .from("program_video_settings")
      .select("capability_tier, storage_cap_bytes, shared_storage_scope")
      .eq("program_id", programId)
      .maybeSingle()

    return NextResponse.json({
      programId,
      programPooledBytesUsed: programPooledBytes,
      teams: perTeam,
      programDefaults: progSettings ?? null,
      notes:
        "When shared_storage_scope is program on entitlements, compare programPooledBytesUsed to the program storage cap.",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (e instanceof MembershipLookupError || msg.includes("Access denied")) {
      return NextResponse.json({ error: msg || "Forbidden" }, { status: 403 })
    }
    throw e
  }
}
