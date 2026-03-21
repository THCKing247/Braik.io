/**
 * Coach B reasoning helpers. Reason over already-built BraikContext only; no fetching.
 * Used to produce structured pre-analysis (Coordinator Analysis) for the prompt.
 */

import type { BraikContext, PlayerContext, InjuryContext, PlayContext } from "./types"

/** Confidence derived from how much relevant context is available; do not invent. */
export type CoordinatorConfidence = "high" | "medium" | "low"

/** Result shape for coordinator tools: concise summary + optional details + limitations + confidence. */
export interface CoordinatorResult {
  summary: string
  details?: string[]
  limitations: string[]
  /** Derived from context coverage: high = strong data, medium = partial, low = missing key data or metadata-only. */
  confidence: CoordinatorConfidence
  /** Optional short "what this is based on" line for explainability (e.g. "Based on: depth chart, availability, and passing stats."). */
  basedOn?: string
}

/** Position filter from message (e.g. "QB", "WR") — simple token match. */
function positionsFromMessage(message: string): string[] {
  const lower = message.toLowerCase()
  const posMap: Record<string, string> = {
    qb: "QB", quarterback: "QB", wr: "WR", "wide receiver": "WR", "wide receivers": "WR",
    rb: "RB", "running back": "RB", te: "TE", "tight end": "TE", ol: "OL", dl: "DL",
    lb: "LB", linebacker: "LB", db: "DB", cb: "CB", safety: "S", k: "K", p: "P",
  }
  const out: string[] = []
  for (const [key, token] of Object.entries(posMap)) {
    if (lower.includes(key) && !out.includes(token)) out.push(token)
  }
  return out
}

/** Whether a player is available (not out / limited). */
function isAvailable(p: PlayerContext): boolean {
  const a = (p.availability ?? "").toLowerCase()
  const i = (p.injuryStatus ?? "").toLowerCase()
  if (a.includes("out") || i.includes("out")) return false
  if (a.includes("limited") || i.includes("doubtful")) return true
  return true
}

/** Check if message asks for "healthy" / "available" only. */
function wantsHealthyOnly(message: string): boolean {
  return /\bhealthy\b|\bavailable\b|who can play|who's (in|playing)/i.test(message)
}

/** Extract numeric value from a stat object (e.g. passing.yards, rushing.yards). */
function statNumber(s: Record<string, unknown> | null, ...keys: string[]): number {
  if (!s || typeof s !== "object") return 0
  for (const k of keys) {
    const v = s[k]
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

/** Which stat category to prefer for a position (for ranking). */
function preferredStatKey(position: string | null, message: string): "passing" | "rushing" | "receiving" | "defense" | null {
  const pos = (position ?? "").toUpperCase()
  const lower = message.toLowerCase()
  if (/\bqb\b|quarterback|pass|start\s+.*qb/i.test(lower) || pos === "QB") return "passing"
  if (/\brb\b|running\s+back|carries|rush/i.test(lower) || pos === "RB" || pos === "FB") return "rushing"
  if (/\bwr\b|receiver|te\b|tight\s+end|rec|catch/i.test(lower) || pos === "WR" || pos === "TE") return "receiving"
  if (/\bdl\b|lb\b|db\b|defense|tackle|sack|interception/i.test(lower) || ["DL", "LB", "DB", "CB", "S"].includes(pos)) return "defense"
  return null
}

/** Score a player for start/carries decision: starter, depth order, availability, position match, relevant stats. */
function scorePlayerForDecision(
  p: PlayerContext,
  positionMatch: boolean,
  injuredIds: Set<string>,
  preferredStat: "passing" | "rushing" | "receiving" | "defense" | null
): { score: number; reason: string } {
  let score = 0
  const parts: string[] = []
  if (p.starter) {
    score += 30
    parts.push("starter")
  }
  const depthStr = (p.depthChartOrder ?? "").toLowerCase()
  const string1 = depthStr.includes("string 1") || depthStr.includes("1")
  if (string1) {
    score += 25
    if (!parts.includes("starter")) parts.push("string 1")
  } else if (depthStr) score += 10
  if (!injuredIds.has(p.id)) {
    score += 20
    parts.push("available")
  } else parts.push("injury status")
  if (positionMatch) score += 10
  const st = p.stats
  if (preferredStat && st) {
    const obj = st[preferredStat]
    if (obj && typeof obj === "object") {
      const yards = statNumber(obj as Record<string, unknown>, "yards", "yards")
      const tds = statNumber(obj as Record<string, unknown>, "tds", "touchdowns")
      const rec = statNumber(obj as Record<string, unknown>, "receptions", "rec")
      const num = yards + tds * 20 + rec * 2
      if (num > 0) {
        score += Math.min(25, Math.floor(num / 50))
        parts.push(`${preferredStat} stats in context`)
      }
    }
  }
  if (p.trendSummary?.trim()) {
    score += 8
    parts.push("recent trend in context")
  }
  const part = (p.practiceParticipation ?? "").toLowerCase()
  if (part.includes("full")) score += 5
  else if (part.includes("limited") || part.includes("dnp")) score -= 5
  const reason = parts.length ? parts.join(", ") : "in context"
  return { score, reason }
}

/**
 * Analyze who should start / get the nod. Ranks candidates by starter, depth, availability, position match, and position-relevant stats.
 */
export function analyzePlayerDecision(context: BraikContext, message: string): CoordinatorResult {
  const limitations: string[] = []
  const positions = positionsFromMessage(message).length ? positionsFromMessage(message) : context.entities.positions.slice()
  const wantHealthy = wantsHealthyOnly(message)
  let pool = context.players

  if (positions.length > 0) {
    pool = pool.filter((p) => {
      const pos = (p.primaryPosition ?? "").toUpperCase()
      const sec = (p.secondaryPositions ?? "").toUpperCase()
      return positions.some((posToken) => pos === posToken || sec.includes(posToken))
    })
    if (pool.length === 0) pool = context.players
  }
  if (wantHealthy) {
    const available = pool.filter(isAvailable)
    if (available.length < pool.length) {
      pool = available
      limitations.push("Filtered to available/healthy players only.")
    }
  }

  const injuredIds = new Set(context.injuries.map((i) => i.playerId))
  const withInjury = pool.filter((p) => injuredIds.has(p.id))
  const withoutInjury = pool.filter((p) => !injuredIds.has(p.id))
  const preferredStat = positions.length > 0 ? preferredStatKey(positions[0], message) : preferredStatKey(null, message)

  if (pool.length === 0) {
    return {
      summary: "No players in context match the question (position or availability).",
      limitations: context.players.length === 0
        ? ["No player data in context."]
        : ["No players matched the requested position or availability filter."],
      confidence: "low",
    }
  }

  const scored = pool.map((p) => {
    const posMatch = positions.length === 0 || positions.some((posToken) => (p.primaryPosition ?? "").toUpperCase() === posToken)
    const { score, reason } = scorePlayerForDecision(p, posMatch, injuredIds, preferredStat)
    return { player: p, score, reason }
  })
  scored.sort((a, b) => b.score - a.score)
  const topCandidates = scored.slice(0, 5)
  const first = topCandidates[0]
  const second = topCandidates[1]

  const hasStats = pool.some((p) =>
    Object.values(p.stats || {}).some((s) => s != null && typeof s === "object" && Object.keys(s).length > 0)
  )
  if (!hasStats) limitations.push("Braik does not have stats in context; recommendation is based on depth and availability only.")
  if (context.players.length > 0 && !context.entities.namedPlayers.length && !context.entities.positions.length) {
    limitations.push("No specific position or names in the question; used full player set from context.")
  }

  /** Top 1–2 weighted factors from #1's reason (coach-friendly labels). */
  const topFactorsFromReason = (reason: string): string[] => {
    const parts = reason.split(", ").filter(Boolean)
    const out: string[] = []
    if (parts.some((x) => /starter|string\s*1/.test(x))) out.push("starter/depth")
    else if (parts.some((x) => /depth|string/.test(x))) out.push("depth")
    if (parts.some((x) => /available|injury/.test(x))) out.push("availability")
    if (parts.some((x) => /passing|rushing|receiving|defense/.test(x))) out.push(preferredStat ? `${preferredStat} production` : "stats")
    return out.slice(0, 2)
  }

  const CLOSE_SCORE_GAP = 15
  const isClose = first && second && second.score > 0 && first.score - second.score <= CLOSE_SCORE_GAP

  let summary: string
  let basedOn: string | undefined
  const reasons: string[] = []
  if (withoutInjury.length > 0 && withInjury.length > 0) reasons.push(`${withoutInjury.length} available; ${withInjury.length} with injury status.`)
  if (context.rosterSummary) reasons.push(`Roster depth by position available.`)
  if (context.schedule.length > 0) reasons.push("Upcoming schedule in context (use for 'this week' if relevant).")
  if (hasStats) reasons.push("Player stats (passing/rushing/receiving/defense) in context; use for production-based recommendation.")
  const hasRecentTrend = pool.some((p) => (p.trendSummary ?? p.recentGames?.length) && (p.trendSummary?.trim() || (p.recentGames?.length ?? 0) > 0))
  if (hasRecentTrend) reasons.push("Recent game trend in context; use for 'hotter lately' or 'last 3 games' when present.")
  const hasParticipation = pool.some((p) => (p.practiceParticipation ?? "").trim().length > 0)
  if (hasParticipation) reasons.push("Practice participation in context; factor in limited/DNP for game-time decisions.")

  if (first) {
    const name1 = `${first.player.fullName} #${first.player.jerseyNumber ?? "—"} (${first.player.primaryPosition ?? "—"})`
    const topFactors = topFactorsFromReason(first.reason)
    if (topFactors.length > 0) {
      summary = `#1: ${name1} — ${first.reason}. Top factors: ${topFactors.join(", ")}.`
      basedOn = `Based on: ${topFactors.join(", ")}${hasStats ? ", and stats in context" : " and depth/availability"}.`
    } else {
      summary = `#1: ${name1} — ${first.reason}.`
      basedOn = hasStats ? "Based on: depth, availability, and stats in context." : "Based on: depth chart and availability."
    }
    if (second && second.score > 0) {
      const name2 = second.player.fullName
      if (isClose) {
        summary += ` It's close, but ${first.player.fullName} gets the edge because ${first.reason}; ${name2} has ${second.reason}.`
      } else {
        summary += ` #2 (${name2}) has ${second.reason}.`
      }
    }
  } else {
    summary = `Strongest candidates from context: ${topCandidates.map((s) => `${s.player.fullName} #${s.player.jerseyNumber ?? "—"}`).join("; ")}. Base recommendation on depth order and availability.`
  }

  const details: string[] = []
  if (basedOn) details.push(basedOn)
  details.push(...reasons)
  topCandidates.slice(0, 3).forEach((s, i) => {
    details.push(`  ${i + 1}. ${s.player.fullName} #${s.player.jerseyNumber ?? "—"} (${s.reason})`)
  })

  const hasDepth = pool.some((p) => (p.depthChartOrder ?? "").trim().length > 0)
  const hasInjuryData = context.injuries.length > 0
  const narrowed = pool.length < context.players.length || wantHealthy
  const signalsCount = [hasStats, hasDepth, hasInjuryData, hasRecentTrend, hasParticipation].filter(Boolean).length
  let confidence: "high" | "medium" | "low" = "medium"
  if (narrowed && signalsCount >= 2 && (hasStats || hasDepth)) confidence = "high"
  else if (hasStats && hasDepth) confidence = "high"
  else if (hasRecentTrend && (hasStats || hasDepth)) confidence = "high"
  else if (!hasStats && (hasDepth || hasInjuryData || hasParticipation)) confidence = "medium"
  else confidence = "low"

  return {
    summary,
    details: details.length ? details : undefined,
    limitations: limitations.length ? limitations : [],
    confidence,
    basedOn,
  }
}

/** One-number "total" for a player's relevant stats (for comparison). Prefer position-relevant category. */
function playerStatTotal(p: PlayerContext, prefer: "passing" | "rushing" | "receiving" | "defense" | null): number {
  const st = p.stats
  if (!st) return 0
  const passing = statNumber((st.passing ?? null) as Record<string, unknown>, "yards", "yards") + statNumber((st.passing ?? null) as Record<string, unknown>, "tds") * 15
  const rushing = statNumber((st.rushing ?? null) as Record<string, unknown>, "yards", "yards") + statNumber((st.rushing ?? null) as Record<string, unknown>, "tds") * 12
  const receiving = statNumber((st.receiving ?? null) as Record<string, unknown>, "yards", "yards") + statNumber((st.receiving ?? null) as Record<string, unknown>, "receptions", "rec") * 2 + statNumber((st.receiving ?? null) as Record<string, unknown>, "tds") * 12
  const defense = statNumber((st.defense ?? null) as Record<string, unknown>, "tackles") * 2 + statNumber((st.defense ?? null) as Record<string, unknown>, "sacks") * 10 + statNumber((st.defense ?? null) as Record<string, unknown>, "interceptions") * 15
  if (prefer === "passing") return passing
  if (prefer === "rushing") return rushing
  if (prefer === "receiving") return receiving
  if (prefer === "defense") return defense
  return Math.max(passing, rushing, receiving, defense)
}

/**
 * Compare two or more players. Side-by-side: who leads in stats, who has better availability, who is ahead on depth. Decisive summary when context favors one.
 */
export function comparePlayers(context: BraikContext, message: string): CoordinatorResult {
  const limitations: string[] = []
  let pool = context.players
  const named = context.entities.namedPlayers
  if (named.length > 0) {
    pool = pool.filter((p) => named.some((n) => p.fullName.toLowerCase().includes(n.toLowerCase())))
  }
  if (pool.length < 2) {
    pool = context.players.slice(0, 5)
    if (named.length > 0) limitations.push("Could not resolve all named players in context; showing available comparison set.")
  }

  const hasStats = pool.some((p) =>
    Object.values(p.stats || {}).some((s) => s != null && typeof s === "object" && Object.keys(s).length > 0)
  )
  const prefer = preferredStatKey(pool[0]?.primaryPosition ?? null, message)
  const injuredIds = new Set(context.injuries.map((i) => i.playerId))

  const lines: string[] = []
  for (const p of pool.slice(0, 5)) {
    const parts = [`${p.fullName} #${p.jerseyNumber ?? "—"} ${p.primaryPosition ?? "—"}`, p.availability]
    if (p.starter) parts.push("starter")
    if (p.depthChartOrder) parts.push(`depth: ${p.depthChartOrder}`)
    if (p.injuryStatus) parts.push(`injury: ${p.injuryStatus}`)
    if (p.trendSummary) parts.push(`recent: ${p.trendSummary}`)
    if (p.practiceParticipation) parts.push(`practice: ${p.practiceParticipation}`)
    if (hasStats) {
      const total = playerStatTotal(p, prefer)
      if (total > 0) parts.push(`stats total: ${total}`)
    }
    if (p.coachNotes) parts.push(`notes: ${String(p.coachNotes).slice(0, 60)}`)
    lines.push(`  • ${parts.join(" | ")}`)
  }

  /** Build explicit win categories: who leads on depth, availability, stats. */
  const winCategories: string[] = []
  let summary: string
  let basedOn: string | undefined
  if (pool.length >= 2 && (hasStats || pool.some((p) => p.depthChartOrder || p.starter))) {
    const byStat = hasStats ? [...pool].sort((a, b) => playerStatTotal(b, prefer) - playerStatTotal(a, prefer)) : null
    const byAvailability = pool.filter((p) => !injuredIds.has(p.id)).length < pool.length ? [...pool].sort((a, b) => (injuredIds.has(a.id) ? 1 : 0) - (injuredIds.has(b.id) ? 1 : 0)) : null
    const byDepth = [...pool].sort((a, b) => (a.depthChartOrder ?? "z").localeCompare(b.depthChartOrder ?? "z"))
    const firstStat = byStat?.[0]
    const firstAvail = byAvailability?.[0]
    const firstDepth = byDepth[0]
    if (hasStats && firstStat && firstStat.id !== byStat?.[1]?.id) winCategories.push(`${firstStat.fullName} leads on stats`)
    if (firstDepth && firstDepth.id !== byDepth[1]?.id) winCategories.push(`${firstDepth.fullName} is ahead on depth`)
    if (firstAvail && !injuredIds.has(firstAvail.id) && pool.some((p) => injuredIds.has(p.id))) winCategories.push(`${firstAvail.fullName} is healthier / available`)
    const favorsOne = firstStat && firstAvail && firstDepth && firstStat.id === firstAvail.id && firstAvail.id === firstDepth.id
    if (favorsOne) {
      summary = `Context favors ${firstStat!.fullName}: leads on ${hasStats ? "stats" : ""}${hasStats && firstDepth ? ", " : ""}depth, and is ${injuredIds.has(firstStat.id) ? "injured" : "available"}. Use for decisive comparison.`
      basedOn = `Based on: depth, availability${hasStats ? ", and stats" : ""} in context.`
    } else if (winCategories.length > 0) {
      summary = `Split advantages: ${winCategories.join("; ")}. No single clear leader—compare by these categories.`
      basedOn = `Based on: depth, availability${hasStats ? ", and stats" : ""} in context.`
    } else {
      summary = `Players in scope: ${pool.map((p) => p.fullName).join(", ")}. Compare by depth, availability, and ${hasStats ? "stats" : "coach notes"}; no single clear leader in context.`
      basedOn = hasStats ? "Based on: depth, availability, and stats in context." : "Based on: depth and availability only."
    }
  } else {
    summary = `Players in scope for comparison: ${pool.map((p) => p.fullName).join(", ")}.`
    basedOn = hasStats ? "Based on: depth, availability, and stats in context." : "Based on: depth and availability."
  }

  if (!hasStats) limitations.push("No stats in context; comparison is based on depth, availability, and coach notes only.")
  if (hasStats) lines.push("Stats in context; cite passing/rushing/receiving/defense where available for comparison.")
  const hasRecentTrend = pool.some((p) => (p.trendSummary ?? "").trim().length > 0)
  if (hasRecentTrend) lines.push("Recent game trend in context; use for who has been hotter lately.")
  const outDetails = basedOn ? [basedOn, ...lines] : lines

  const signalsCount = [hasStats, pool.some((p) => (p.depthChartOrder ?? "").trim().length > 0), pool.some((p) => injuredIds.has(p.id)), hasRecentTrend].filter(Boolean).length
  const confidence: "high" | "medium" | "low" = pool.length >= 2 && (hasStats || signalsCount >= 2 || hasRecentTrend) ? "high" : pool.length >= 2 ? "medium" : "low"

  return {
    summary,
    details: outDetails.length ? outDetails : undefined,
    limitations,
    confidence,
    basedOn,
  }
}

/**
 * Summarize injury report: by severity, starters impacted, backup implications.
 */
export function summarizeInjuries(context: BraikContext, _message: string): CoordinatorResult {
  const limitations: string[] = []
  if (context.injuries.length === 0) {
    return {
      summary: "No injury entries in context.",
      limitations: ["No injury data in context."],
      confidence: "low",
    }
  }

  const byStatus = new Map<string, InjuryContext[]>()
  for (const i of context.injuries) {
    const s = (i.status ?? "unknown").toLowerCase()
    if (!byStatus.has(s)) byStatus.set(s, [])
    byStatus.get(s)!.push(i)
  }
  const out: string[] = []
  const order = ["out", "doubtful", "questionable", "limited", "full", "unknown"]
  for (const status of order) {
    const list = byStatus.get(status)
    if (!list?.length) continue
    out.push(`${status}: ${list.map((i) => i.fullName).join(", ")}`)
  }
  const startersImpacted = context.injuries.filter((i) => {
    const p = context.players.find((x) => x.id === i.playerId)
    return p?.starter
  })
  if (startersImpacted.length > 0) {
    out.push(`Starters impacted: ${startersImpacted.map((i) => i.fullName).join(", ")}.`)
  }
  const withReturn = context.injuries.filter((i) => i.expectedReturn?.trim())
  if (withReturn.length > 0) {
    out.push(`Expected return noted for: ${withReturn.map((i) => `${i.fullName} (~${String(i.expectedReturn).slice(0, 10)})`).join("; ")}.`)
  }
  const practiceExempt = context.injuries.filter((i) => i.exemptFromPractice)
  if (practiceExempt.length > 0) {
    out.push(`Practice exempt: ${practiceExempt.map((i) => i.fullName).join(", ")}.`)
  }
  const withSeverity = context.injuries.filter((i) => (i.severity ?? "").trim().length > 0)
  if (withSeverity.length > 0) {
    out.push(
      `Severity noted: ${withSeverity.map((i) => `${i.fullName} (${i.severity})`).join("; ")}.`
    )
  }
  const withParticipation = context.injuries.filter((i) => (i.practiceParticipation ?? "").trim().length > 0)
  if (withParticipation.length > 0) {
    out.push(`Practice participation: ${withParticipation.map((i) => `${i.fullName} (${i.practiceParticipation})`).join("; ")}.`)
  }

  const hasParticipation = context.injuries.some((i) => (i.practiceParticipation ?? "").trim().length > 0)
  const hasSeverity = withSeverity.length > 0
  const confidence: "high" | "medium" | "low" =
    context.injuries.length > 0 &&
    (startersImpacted.length > 0 || withReturn.length > 0 || hasParticipation || practiceExempt.length > 0 || hasSeverity)
      ? "high"
      : context.injuries.length > 0
        ? "medium"
        : "low"

  return {
    summary: `Injury report: ${context.injuries.length} player(s). ${out.slice(0, 3).join(" ")}`,
    details: out,
    limitations,
    confidence,
  }
}

/**
 * Summarize schedule: group by type, upcoming games/practices.
 */
export function summarizeSchedule(context: BraikContext, _message: string): CoordinatorResult {
  const limitations: string[] = []
  if (context.schedule.length === 0) {
    return {
      summary: "No schedule events in context.",
      limitations: ["No schedule data in context."],
      confidence: "low",
    }
  }

  const games = context.schedule.filter((s) => s.type === "game")
  const practices = context.schedule.filter((s) => s.type === "practice")
  const other = context.schedule.filter((s) => s.type !== "game" && s.type !== "practice")
  const lines: string[] = []
  if (games.length > 0) {
    lines.push(`Games: ${games.map((g) => `${g.start.slice(0, 10)} vs ${g.opponent ?? "TBD"}${g.location ? ` @ ${g.location}` : ""}`).join("; ")}.`)
  }
  if (practices.length > 0) {
    lines.push(`Practices: ${practices.length} (e.g. ${practices[0].start.slice(0, 10)} ${practices[0].title ?? "Practice"}).`)
  }
  if (other.length > 0) {
    lines.push(`Other events: ${other.map((e) => e.title || e.type).join(", ")}.`)
  }

  const nextGame = games[0]
  const nextSummary = nextGame ? `Next game: ${nextGame.start.slice(0, 10)} vs ${nextGame.opponent ?? "TBD"}.` : "No games in context."
  if (context.opponentTendencies?.length > 0) {
    const t = context.opponentTendencies[0]
    const tendencyParts = [t.coverageTendency, t.pressureTendency, t.runPassTendency, t.redZoneTendency].filter(Boolean)
    if (tendencyParts.length) lines.push(`Next opponent tendencies: ${tendencyParts.join("; ")}.`)
  }

  const confidence: "high" | "medium" | "low" = games.length > 0 ? "high" : practices.length > 0 ? "medium" : "low"

  return {
    summary: nextSummary + " " + lines.join(" "),
    details: lines,
    limitations,
    confidence,
  }
}

/**
 * Find plays by formation (and optional tags/concepts). Summarize formations and plays from context.
 */
export function findPlaysByFormation(context: BraikContext, message: string): CoordinatorResult {
  const limitations: string[] = []
  if (context.plays.length === 0 && context.formations.length === 0) {
    return {
      summary: "No playbook data in context.",
      limitations: ["No formations or plays in context."],
      confidence: "low",
    }
  }

  const lower = message.toLowerCase()
  let plays = context.plays
  const formationNames = context.entities.formationNames.length ? context.entities.formationNames : context.formations.map((f) => f.name)
  if (formationNames.length > 0) {
    plays = plays.filter((p) => formationNames.some((f) => p.formation?.toLowerCase().includes(f.toLowerCase())))
  }
  if (plays.length === 0) plays = context.plays

  const motionPlays = lower.includes("motion") ? plays.filter((p) => (p.motion ?? "").trim().length > 0) : null
  const usePlays = motionPlays && motionPlays.length > 0 ? motionPlays : plays

  const formationGroups = new Map<string, PlayContext[]>()
  for (const p of usePlays.slice(0, 30)) {
    const key = p.formation || "Other"
    if (!formationGroups.has(key)) formationGroups.set(key, [])
    formationGroups.get(key)!.push(p)
  }
  const details: string[] = []
  for (const [form, list] of formationGroups) {
    details.push(`${form}: ${list.map((p) => p.name + (p.concept ? ` (${p.concept})` : "")).join(", ")}`)
  }

  const confidence: "high" | "medium" | "low" = usePlays.length > 0 && formationNames.length > 0 ? "high" : usePlays.length > 0 ? "medium" : "low"

  return {
    summary: `Formations in context: ${context.formations.map((f) => f.name).join(", ")}. Plays found: ${usePlays.length}. ${formationNames.length ? "Filtered by: " + formationNames.join(", ") : ""}`,
    details: details.length ? details : undefined,
    limitations,
    confidence,
  }
}

/** Score a play for situation recommendation: formation match, situation match, concept/tag match, motion. */
function scorePlayForSituation(
  p: PlayContext,
  message: string,
  formationNames: string[],
  hasRedZone: boolean,
  hasSituation: boolean,
  wantsMotion: boolean
): { score: number; reasons: string[] } {
  const lower = message.toLowerCase()
  const reasons: string[] = []
  let score = 0
  const formMatch = formationNames.length > 0 && formationNames.some((f) => (p.formation ?? "").toLowerCase().includes(f.toLowerCase()))
  if (formMatch) {
    score += 25
    reasons.push("formation match")
  }
  const sit = (p.situation ?? "").toLowerCase()
  const tags = (p.tags ?? []).join(" ").toLowerCase()
  const concept = (p.concept ?? "").toLowerCase()
  if (hasRedZone && (sit.includes("red") || sit.includes("goal") || tags.includes("red") || concept.includes("red"))) {
    score += 30
    reasons.push("red zone / goal line")
  }
  if (hasSituation && (sit.includes("3rd") || sit.includes("short") || sit.includes("medium") || sit.includes("long") || tags.includes("3rd"))) {
    score += 25
    reasons.push("situation match")
  }
  if (concept || (p.tags ?? []).length > 0) {
    score += 10
    if (concept) reasons.push(`concept: ${p.concept}`)
  }
  if (wantsMotion && (p.motion ?? "").trim().length > 0) {
    score += 20
    reasons.push("has motion")
  }
  if (p.successRate != null && p.usageCount != null && p.usageCount > 0) {
    score += 15
    reasons.push(`success rate ${Math.round(p.successRate * 100)}% (${p.usageCount} calls)`)
  }
  if (p.avgYards != null && p.avgYards > 0) reasons.push(`avg ${p.avgYards} yds`)
  if (!formMatch && (p.formation ?? "").length > 0) score += 5
  return { score, reasons }
}

/**
 * Recommend plays for situation (red zone, 3rd down, matchup). Ranks by formation match, situation match, concept/tag, motion. Returns top 2–3 with short reasons.
 */
export function recommendPlaysForSituation(context: BraikContext, message: string): CoordinatorResult {
  const limitations: string[] = []
  if (context.plays.length === 0) {
    return {
      summary: "No plays in context to recommend.",
      limitations: ["No playbook data in context."],
      confidence: "low",
    }
  }

  const lower = message.toLowerCase()
  const concepts = context.entities.concepts.length ? context.entities.concepts : []
  const hasRedZone = lower.includes("red zone") || concepts.some((c) => /red\s*zone|goal\s*line/i.test(c))
  const hasSituation = lower.includes("3rd") || lower.includes("third") || concepts.some((c) => /3rd|short|medium|long/i.test(c))
  const wantsMotion = lower.includes("motion")
  const formationNames = context.entities.formationNames.length ? context.entities.formationNames : []
  let subset = context.plays
  if (hasRedZone || hasSituation) {
    subset = context.plays.filter((p) => {
      const sit = (p.situation ?? "").toLowerCase()
      const tags = (p.tags ?? []).join(" ").toLowerCase()
      const concept = (p.concept ?? "").toLowerCase()
      if (hasRedZone && (sit.includes("red") || sit.includes("goal") || tags.includes("red") || concept.includes("red"))) return true
      if (hasSituation && (sit.includes("3rd") || sit.includes("short") || sit.includes("medium") || tags.includes("3rd"))) return true
      return false
    })
    if (subset.length === 0) subset = context.plays
  }

  if (formationNames.length > 0) {
    const byForm = subset.filter((p) => formationNames.some((f) => (p.formation ?? "").toLowerCase().includes(f.toLowerCase())))
    if (byForm.length > 0) subset = byForm
  }

  const scored = subset.map((p) => {
    const { score, reasons } = scorePlayForSituation(p, message, formationNames, hasRedZone, hasSituation, wantsMotion)
    return { play: p, score, reasons }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 5)
  const top2_3 = top.slice(0, 3)

  const reasons: string[] = []
  const nextGame = context.schedule.find((s) => s.type === "game")
  if (nextGame?.opponent) reasons.push(`Upcoming opponent in context: ${nextGame.opponent} (from schedule). Use for matchup-specific suggestions.`)
  if (context.opponentTendencies?.length > 0) {
    const t = context.opponentTendencies[0]
    const parts = [t.coverageTendency, t.pressureTendency, t.runPassTendency].filter(Boolean)
    if (parts.length) reasons.push(`Opponent tendencies: ${parts.join("; ")}. Use for play fit.`)
  }
  if (context.reports.length > 0 && /matchup|scouting|opponent|fit\s+that|vs\.?/i.test(message)) reasons.push("Scouting or report excerpts in Braik context may inform matchup; cite if relevant.")
  if (subset.length < context.plays.length) reasons.push(`Filtered to situation-relevant plays (${subset.length}).`)
  const hasPlayAnalytics = subset.some((p) => (p.successRate != null && p.usageCount != null) || (p.avgYards != null && p.avgYards > 0))
  if (hasPlayAnalytics) reasons.push("Play success/usage analytics in context; prefer plays with stronger success rate when cited.")

  const CLOSE_PLAY_SCORE_GAP = 15
  const first = top2_3[0]
  const second = top2_3[1]
  const secondIsClose = first && second && second.score > 0 && first.score - second.score <= CLOSE_PLAY_SCORE_GAP

  let summary: string
  let basedOn: string | undefined
  if (top2_3.length > 0 && first) {
    const phraseParts: string[] = []
    if (first.play.formation) phraseParts.push(`matches ${first.play.formation}`)
    const sitReason = first.reasons.find((r) => /red zone|goal line|situation match/.test(r))
    if (sitReason) phraseParts.push(/red zone|goal/.test(sitReason) ? "is tagged for red zone" : "is tagged for this situation")
    else if (first.reasons.length > 0) phraseParts.push(first.reasons.join(", "))
    summary = `${first.play.name} ranks first because it ${phraseParts.length ? phraseParts.join(" and ") : "fits formation and situation"}.`
    if (second) {
      if (secondIsClose) {
        summary += ` Close alternative: ${second.play.name} (${second.reasons.join(", ") || "same formation/situation"}).`
      } else {
        summary += ` Second: ${second.play.name} — ${second.reasons.join(", ") || "in context"}.`
      }
    }
    if (top2_3[2]) summary += ` Third: ${top2_3[2].play.name}.`
    basedOn = `Based on: formation match, situation/tags${wantsMotion ? ", motion" : ""} in context.`
  } else {
    summary = `Recommended plays from context: ${top.map((s) => s.play.name).join("; ")}. Base recommendation on formation and situation.`
    basedOn = "Based on: formation and situation in context."
  }

  reasons.push(...top2_3.map((s, i) => `  ${i + 1}. ${s.play.name} (${s.play.formation}) — ${s.reasons.join(", ") || "in context"}`))

  const noSituationTags = subset.length === context.plays.length && (hasRedZone || hasSituation)
  if (noSituationTags) limitations.push("No situation tags on plays in context; showing full play set.")
  const wantsSuccessRate = /best|success|rate|conversion|hit/i.test(message)
  const hasSuccessRateData = context.plays.some((p) => p.successRate != null && p.usageCount != null && p.usageCount > 0)
  if (wantsSuccessRate && !hasSuccessRateData) {
    limitations.push("Braik does not have success-rate or conversion data for plays; recommendation is by formation and situation fit only.")
  }

  const narrowed = subset.length < context.plays.length && subset.length > 0
  const formationSignal = formationNames.length > 0
  const situationSignal = hasRedZone || hasSituation
  const topHasScore = (top[0]?.score ?? 0) > 0
  const hasTendencies = (context.opponentTendencies?.length ?? 0) > 0
  const hasMultipleSignals = [formationSignal, situationSignal, topHasScore, hasPlayAnalytics, hasTendencies].filter(Boolean).length >= 2
  const confidence: "high" | "medium" | "low" = narrowed && hasMultipleSignals ? "high" : (context.plays.length > 0 && (hasPlayAnalytics || hasTendencies)) ? "high" : context.plays.length > 0 ? "medium" : "low"

  return {
    summary,
    details: reasons.length ? reasons : undefined,
    limitations,
    confidence,
    basedOn,
  }
}

/**
 * Summarize report/document chunks. Honest when only metadata exists.
 */
export function summarizeReport(context: BraikContext, _message: string): CoordinatorResult {
  const limitations: string[] = []
  if (context.reports.length === 0) {
    return {
      summary: "No report or document data in context.",
      limitations: ["No report data in context."],
      confidence: "low",
    }
  }

  const withContent = context.reports.filter((r) => r.hasExtractedText && (r.excerpt?.trim().length ?? 0) > 0)
  const metadataOnly = context.reports.filter((r) => !r.hasExtractedText || !(r.excerpt?.trim().length ?? 0))

  if (withContent.length === 0) {
    return {
      summary: `Braik has ${context.reports.length} document(s) in context but no extracted text: ${context.reports.map((r) => r.source + " (" + (r.type ?? "document") + ")").join(", ")}. Cannot summarize contents.`,
      limitations: ["Only document titles/categories available; no body text to summarize."],
      confidence: "low",
    }
  }

  const sources = [...new Set(withContent.map((r) => r.source + ": " + (r.type ?? "document")))]
  const totalExcerptLen = withContent.reduce((acc, r) => acc + (r.excerpt?.length ?? 0), 0)
  const confidence: "high" | "medium" | "low" = metadataOnly.length > 0 ? "medium" : "high"

  return {
    summary: `${withContent.length} document chunk(s) with extracted content (${sources.join("; ")}). Total excerpt length ${totalExcerptLen} chars. Summarize from the provided excerpts; do not invent content.`,
    details: withContent.slice(0, 5).map((r) => `[${r.source}] ${(r.type ?? "").slice(0, 30)}: "${String(r.excerpt).slice(0, 120)}…"`),
    limitations: metadataOnly.length > 0 ? [`${metadataOnly.length} doc(s) have metadata only.`] : [],
    confidence,
  }
}

/** Coordinator analysis to inject into the prompt. */
export interface CoordinatorAnalysis {
  tool: string
  result: CoordinatorResult
}

/** Pick and run the best coordinator tool by domain/intent. Returns null if none apply or context is generic. */
export function runCoordinatorTool(context: BraikContext, message: string): CoordinatorAnalysis | null {
  const { domain, intent } = context
  if (domain === "generic" && intent === "generic") return null

  const run = (tool: string, result: CoordinatorResult): CoordinatorAnalysis => ({ tool, result })

  switch (intent) {
    case "player_decision":
    case "player_availability": {
      const result = analyzePlayerDecision(context, message)
      return run("analyzePlayerDecision", result)
    }
    case "player_comparison":
    case "player_evaluation": {
      const result = comparePlayers(context, message)
      return run("comparePlayers", result)
    }
    case "injury_summary": {
      const result = summarizeInjuries(context, message)
      return run("summarizeInjuries", result)
    }
    case "schedule_summary": {
      const result = summarizeSchedule(context, message)
      return run("summarizeSchedule", result)
    }
    case "play_lookup":
    case "formation_lookup": {
      const result = findPlaysByFormation(context, message)
      return run("findPlaysByFormation", result)
    }
    case "play_recommendation": {
      const result = recommendPlaysForSituation(context, message)
      return run("recommendPlaysForSituation", result)
    }
    case "report_summary": {
      const result = summarizeReport(context, message)
      return run("summarizeReport", result)
    }
    default:
      if (domain === "players" && context.players.length > 0) {
        const result = analyzePlayerDecision(context, message)
        return run("analyzePlayerDecision", result)
      }
      if (domain === "injuries" && context.injuries.length > 0) {
        const result = summarizeInjuries(context, message)
        return run("summarizeInjuries", result)
      }
      if (domain === "schedule" && context.schedule.length > 0) {
        const result = summarizeSchedule(context, message)
        return run("summarizeSchedule", result)
      }
      if (domain === "playbooks" && (context.plays.length > 0 || context.formations.length > 0)) {
        if (/\brecommend|best\s*play|suggest|fit\b/i.test(message)) {
          return run("recommendPlaysForSituation", recommendPlaysForSituation(context, message))
        }
        return run("findPlaysByFormation", findPlaysByFormation(context, message))
      }
      if (domain === "reports" && context.reports.length > 0) {
        return run("summarizeReport", summarizeReport(context, message))
      }
      return null
  }
}
