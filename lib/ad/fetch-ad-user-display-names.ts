import type { SupabaseClient } from "@supabase/supabase-js"

const USER_IDS_CHUNK = 120

async function mapIdsInChunks<T>(
  ids: string[],
  chunkSize: number,
  run: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  if (ids.length <= chunkSize) return run(ids)
  const out: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(...(await run(ids.slice(i, i + chunkSize))))
  }
  return out
}

type RpcRow = { user_id: string; display_name: string | null }

/**
 * One RPC round trip per chunk: coalesce(users.name, profiles.full_name).
 * Falls back to parallel users + profiles selects if the RPC is missing (pre-migration deploy).
 */
export async function fetchAdUserDisplayNamesMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds.filter((id) => typeof id === "string" && id.length > 0))]
  const out = new Map<string, string | null>()
  if (unique.length === 0) return out

  const tryRpc = async (): Promise<boolean> => {
    try {
      const rows = await mapIdsInChunks<RpcRow>(unique, USER_IDS_CHUNK, async (chunk) => {
        const { data, error } = await supabase.rpc("ad_user_display_names", {
          p_user_ids: chunk,
        })
        if (error) throw error
        return (data ?? []) as RpcRow[]
      })
      for (const row of rows) {
        if (row?.user_id) out.set(row.user_id, row.display_name?.trim() ? row.display_name : null)
      }
      return true
    } catch {
      return false
    }
  }

  const rpcOk = await tryRpc()
  if (rpcOk) return out

  const [usersRows, profilesRows] = await Promise.all([
    mapIdsInChunks(unique, USER_IDS_CHUNK, async (chunk) => {
      const { data } = await supabase.from("users").select("id, name").in("id", chunk)
      return data ?? []
    }),
    mapIdsInChunks(unique, USER_IDS_CHUNK, async (chunk) => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", chunk)
      return data ?? []
    }),
  ])
  const usersById = new Map<string, { name?: string | null }>()
  for (const u of usersRows) {
    if ((u as { id?: string }).id) usersById.set((u as { id: string }).id, u as { name?: string | null })
  }
  const profilesById = new Map<string, { full_name?: string | null }>()
  for (const p of profilesRows) {
    const id = (p as { id: string }).id
    if (id) profilesById.set(id, p as { full_name?: string | null })
  }
  for (const id of unique) {
    const fromUser = usersById.get(id)?.name?.trim()
    const fromProfile = profilesById.get(id)?.full_name?.trim()
    const nm = fromUser && fromUser.length > 0 ? fromUser : fromProfile && fromProfile.length > 0 ? fromProfile : null
    out.set(id, nm)
  }
  return out
}
