import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { detectDomain } from "./detect-domain"
import { detectIntent } from "./detect-intent"
import { detectEntities } from "./detect-entities"
import { mergeContext } from "./merge-context"
import type { BraikContext, QuestionDomain, DetectedEntities } from "./types"
import { getPlayerContext } from "./player-context"
import { getPlaybookContext } from "./playbook-context"
import { getInjuryContext } from "./injury-context"
import { getScheduleContext } from "./schedule-context"
import { getRosterContext } from "./roster-context"
import { getReportContext } from "./report-context"

export interface BuildResult {
  context: BraikContext
  summary: {
    domain: QuestionDomain
    intent: string
    relatedDomains: QuestionDomain[]
    rosterCount?: number
    profileCount?: number
    statsCount?: number
    playbookCount?: number
    formationCount?: number
    playCount?: number
    injuryCount?: number
    scheduleCount?: number
    reportCount?: number
    namedPlayersMatched?: number
    positionsMatched?: number
  }
}

/**
 * Build full Braik context: detect domain/intent/entities, fetch relevant modules, merge.
 */
export async function buildContext(teamId: string, message: string): Promise<BuildResult | null> {
  try {
    const supabase = getSupabaseServer()
    const { data: team, error: teamErr } = await supabase.from("teams").select("id, name").eq("id", teamId).maybeSingle()
    if (teamErr || !team) {
      console.error("[braik-ai] team fetch failed", { teamId, message: teamErr?.message })
      return null
    }
    const teamInfo = { id: teamId, name: team.name ?? null }

    const { domain, related: relatedDomains } = detectDomain(message)
    const intent = detectIntent(message)

    if (process.env.BRAIK_AI_DEBUG === "1") {
      console.log("[Coach B debug] buildContext: domain=%s intent=%s related=%s message=%s", domain, intent, JSON.stringify(relatedDomains), message.slice(0, 80))
    }

    const { data: rosterForNames } = await supabase.from("players").select("first_name, last_name, preferred_name").eq("team_id", teamId)
    const entities: DetectedEntities = detectEntities(message, rosterForNames ?? [])

    const input = { teamId, message, entities, supabase }
    const domainsToFetch = new Set<QuestionDomain>([domain, ...relatedDomains])

    if (process.env.BRAIK_AI_DEBUG === "1") {
      console.log("[Coach B debug] buildContext: fetching domains=%s", JSON.stringify([...domainsToFetch]))
    }

    let players: BraikContext["players"] | null = null
    let playbooks: BraikContext["playbooks"] | null = null
    let formations: BraikContext["formations"] | null = null
    let plays: BraikContext["plays"] | null = null
    let injuries: BraikContext["injuries"] | null = null
    let schedule: BraikContext["schedule"] | null = null
    let rosterSummary: BraikContext["rosterSummary"] | null = null
    let reports: BraikContext["reports"] | null = null

    if (domainsToFetch.has("players")) {
      players = await getPlayerContext(input)
    }
    if (domainsToFetch.has("playbooks")) {
      const pb = await getPlaybookContext(input)
      if (pb) {
        playbooks = pb.playbooks
        formations = pb.formations
        plays = pb.plays
      }
    }
    if (domainsToFetch.has("injuries")) {
      injuries = await getInjuryContext(input)
    }
    if (domainsToFetch.has("schedule")) {
      schedule = await getScheduleContext(input)
    }
    if (domainsToFetch.has("roster")) {
      rosterSummary = await getRosterContext(input)
    }
    if (domainsToFetch.has("reports")) {
      reports = await getReportContext(input)
    }

    const context = mergeContext({
      team: teamInfo,
      domain,
      intent,
      relatedDomains,
      entities,
      players,
      playbooks,
      formations,
      plays,
      injuries,
      schedule,
      rosterSummary,
      reports,
    })

    if (process.env.BRAIK_AI_DEBUG === "1") {
      console.log("[Coach B debug] buildContext: modules used players=%s playbooks=%s injuries=%s schedule=%s roster=%s reports=%s",
        players != null ? players.length : "—", playbooks != null ? playbooks.length : "—", injuries != null ? injuries.length : "—",
        schedule != null ? schedule.length : "—", rosterSummary != null ? "yes" : "—", reports != null ? reports.length : "—")
    }

    const summary: BuildResult["summary"] = {
      domain,
      intent,
      relatedDomains,
      rosterCount: players?.length ?? rosterSummary?.totalPlayers,
      profileCount: players?.length,
      statsCount: players?.filter((p) => Object.values(p.stats).some((s) => s != null && Object.keys(s).length > 0)).length,
      playbookCount: playbooks?.length,
      formationCount: formations?.length,
      playCount: plays?.length,
      injuryCount: injuries?.length,
      scheduleCount: schedule?.length,
      reportCount: reports?.length,
      namedPlayersMatched: entities.namedPlayers.length,
      positionsMatched: entities.positions.length,
    }

    return { context, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] buildContext failed", { teamId, message: msg })
    return null
  }
}
