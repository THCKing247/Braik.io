import type { SupabaseClient } from "@supabase/supabase-js"
import type { StudyItemType } from "@/lib/study-source-context"

export type StudyItemDescriptor = {
  item_type: StudyItemType
  item_id: string
  sort_order: number
  label: string
  href: string | null
}

export async function hydrateStudyAssignmentItems(
  supabase: SupabaseClient,
  teamId: string,
  items: { item_type: string; item_id: string; sort_order: number }[]
): Promise<StudyItemDescriptor[]> {
  const typed = items.filter((i): i is { item_type: StudyItemType; item_id: string; sort_order: number } =>
    ["playbook", "install_script", "study_pack", "formation", "play"].includes(i.item_type)
  )

  const pbIds = [...new Set(typed.filter((i) => i.item_type === "playbook").map((i) => i.item_id))]
  const formIds = [...new Set(typed.filter((i) => i.item_type === "formation").map((i) => i.item_id))]
  const playIds = [...new Set(typed.filter((i) => i.item_type === "play").map((i) => i.item_id))]
  const scriptIds = [...new Set(typed.filter((i) => i.item_type === "install_script").map((i) => i.item_id))]
  const packIds = [...new Set(typed.filter((i) => i.item_type === "study_pack").map((i) => i.item_id))]

  const [pbs, forms, plays, scripts, packs] = await Promise.all([
    pbIds.length
      ? supabase.from("playbooks").select("id, name").eq("team_id", teamId).in("id", pbIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    formIds.length
      ? supabase.from("formations").select("id, name, playbook_id").eq("team_id", teamId).in("id", formIds)
      : Promise.resolve({ data: [] as { id: string; name: string; playbook_id: string | null }[] }),
    playIds.length
      ? supabase.from("plays").select("id, name, playbook_id").eq("team_id", teamId).in("id", playIds)
      : Promise.resolve({ data: [] as { id: string; name: string; playbook_id: string | null }[] }),
    scriptIds.length
      ? supabase.from("install_scripts").select("id, name, playbook_id").eq("team_id", teamId).in("id", scriptIds)
      : Promise.resolve({ data: [] as { id: string; name: string; playbook_id: string }[] }),
    packIds.length
      ? supabase.from("study_packs").select("id, title").eq("team_id", teamId).in("id", packIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])

  const pbMap = new Map((pbs.data ?? []).map((r) => [r.id, r]))
  const formMap = new Map((forms.data ?? []).map((r) => [r.id, r]))
  const playMap = new Map((plays.data ?? []).map((r) => [r.id, r]))
  const scriptMap = new Map((scripts.data ?? []).map((r) => [r.id, r]))
  const packMap = new Map((packs.data ?? []).map((r) => [r.id, r]))

  return typed
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => {
      if (it.item_type === "playbook") {
        const r = pbMap.get(it.item_id)
        return {
          item_type: it.item_type,
          item_id: it.item_id,
          sort_order: it.sort_order,
          label: r?.name ?? "Playbook",
          href: `/dashboard/playbooks/${encodeURIComponent(it.item_id)}`,
        }
      }
      if (it.item_type === "formation") {
        const r = formMap.get(it.item_id)
        const pb = r?.playbook_id
        return {
          item_type: it.item_type,
          item_id: it.item_id,
          sort_order: it.sort_order,
          label: r?.name ?? "Formation",
          href: pb
            ? `/dashboard/playbooks/${encodeURIComponent(pb)}/formation/${encodeURIComponent(it.item_id)}`
            : null,
        }
      }
      if (it.item_type === "play") {
        const r = playMap.get(it.item_id)
        return {
          item_type: it.item_type,
          item_id: it.item_id,
          sort_order: it.sort_order,
          label: r?.name ?? "Play",
          href: `/dashboard/playbooks/play/${encodeURIComponent(it.item_id)}`,
        }
      }
      if (it.item_type === "install_script") {
        const r = scriptMap.get(it.item_id)
        const pb = r?.playbook_id
        return {
          item_type: it.item_type,
          item_id: it.item_id,
          sort_order: it.sort_order,
          label: r?.name ?? "Install script",
          href: pb
            ? `/dashboard/playbooks/${encodeURIComponent(pb)}/install-scripts/${encodeURIComponent(it.item_id)}`
            : null,
        }
      }
      const r = packMap.get(it.item_id)
      return {
        item_type: it.item_type,
        item_id: it.item_id,
        sort_order: it.sort_order,
        label: r?.title ?? "Study pack",
        href: null,
      }
    })
}
