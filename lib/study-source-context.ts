import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_CONTEXT_CHARS = 12000

export type StudyItemType = "playbook" | "install_script" | "study_pack" | "formation" | "play"

export async function buildStudySourceContextString(
  supabase: SupabaseClient,
  teamId: string,
  sources: { itemType: StudyItemType; itemId: string }[]
): Promise<string> {
  const lines: string[] = []
  for (const s of sources) {
    const line = await oneSourceLine(supabase, teamId, s)
    if (line) lines.push(line)
  }
  let text = lines.join("\n")
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS) + "\n…(truncated)"
  return text
}

async function oneSourceLine(
  supabase: SupabaseClient,
  teamId: string,
  s: { itemType: StudyItemType; itemId: string }
): Promise<string | null> {
  switch (s.itemType) {
    case "playbook": {
      const { data } = await supabase
        .from("playbooks")
        .select("id, name")
        .eq("id", s.itemId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!data?.name) return null
      const { data: plays } = await supabase
        .from("plays")
        .select("name, side, formation")
        .eq("playbook_id", s.itemId)
        .eq("team_id", teamId)
        .order("updated_at", { ascending: false })
        .limit(35)
      const sample = (plays ?? []).map((p) => `${p.name} (${p.side}${p.formation ? `, ${p.formation}` : ""})`).join("; ")
      return `PLAYBOOK "${data.name}" (id ${data.id})${sample ? `. Sample plays: ${sample}` : ""}`
    }
    case "formation": {
      const { data } = await supabase
        .from("formations")
        .select("id, name, side, playbook_id")
        .eq("id", s.itemId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!data?.name) return null
      return `FORMATION "${data.name}" side=${data.side} (id ${data.id}, playbook_id=${data.playbook_id ?? "none"})`
    }
    case "play": {
      const { data } = await supabase
        .from("plays")
        .select("id, name, side, formation, playbook_id")
        .eq("id", s.itemId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!data?.name) return null
      return `PLAY "${data.name}" (${data.side}, formation=${data.formation ?? "—"}) id=${data.id} playbook_id=${data.playbook_id ?? "none"}`
    }
    case "install_script": {
      const { data } = await supabase
        .from("install_scripts")
        .select("id, name, playbook_id")
        .eq("id", s.itemId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!data?.name) return null
      const { data: items } = await supabase
        .from("install_script_items")
        .select("play_id, order_index")
        .eq("script_id", s.itemId)
        .order("order_index", { ascending: true })
        .limit(40)
      const playIds = (items ?? []).map((i) => i.play_id).filter(Boolean)
      let playNames = ""
      if (playIds.length) {
        const { data: plays } = await supabase.from("plays").select("id, name").eq("team_id", teamId).in("id", playIds)
        const map = new Map((plays ?? []).map((p) => [p.id, p.name as string]))
        playNames = (items ?? [])
          .map((i) => map.get(i.play_id as string))
          .filter(Boolean)
          .join(" → ")
      }
      return `INSTALL SCRIPT "${data.name}" (id ${data.id}). Order: ${playNames || "(no plays)"}`
    }
    case "study_pack": {
      const { data } = await supabase
        .from("study_packs")
        .select("id, title, description")
        .eq("id", s.itemId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!data?.title) return null
      const { data: pitems } = await supabase
        .from("study_pack_items")
        .select("item_type, item_id, sort_order")
        .eq("pack_id", s.itemId)
        .order("sort_order", { ascending: true })
        .limit(25)
      const refs = (pitems ?? []).map((r) => `${r.item_type}:${r.item_id}`).join(", ")
      return `STUDY PACK "${data.title}"${data.description ? ` — ${data.description}` : ""}. Items: ${refs || "none"}`
    }
    default:
      return null
  }
}
