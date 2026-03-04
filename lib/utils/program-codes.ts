/**
 * Program Codes Utilities - Supabase
 */

import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { randomBytes } from "crypto"

export function generateProgramCode(): string {
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 8)
}

export async function ensureProgramCodes(teamId: string): Promise<{ playerCode: string | null; parentCode: string | null }> {
  const supabase = getSupabaseServer()
  const { data: team } = await supabase.from("teams").select("player_code, parent_code").eq("id", teamId).maybeSingle()

  if (!team) {
    throw new Error("Team not found")
  }

  const t = team as { player_code?: string | null; parent_code?: string | null }
  let playerCode = t.player_code ?? null
  let parentCode = t.parent_code ?? null
  let needsUpdate = false

  if (!playerCode) {
    playerCode = generateProgramCode()
    let attempts = 0
    let exists = true
    while (exists && attempts < 10) {
      const { data: other } = await supabase.from("teams").select("id").eq("player_code", playerCode).neq("id", teamId).maybeSingle()
      exists = !!other
      if (exists) {
        playerCode = generateProgramCode()
        attempts++
      }
    }
    needsUpdate = true
  }

  if (!parentCode) {
    parentCode = generateProgramCode()
    let attempts = 0
    let exists = true
    while (exists && attempts < 10) {
      const { data: other } = await supabase.from("teams").select("id").eq("parent_code", parentCode).neq("id", teamId).maybeSingle()
      exists = !!other
      if (exists) {
        parentCode = generateProgramCode()
        attempts++
      }
    }
    needsUpdate = true
  }

  if (needsUpdate) {
    await supabase
      .from("teams")
      .update({ player_code: playerCode, parent_code: parentCode })
      .eq("id", teamId)
  }

  return { playerCode, parentCode }
}
