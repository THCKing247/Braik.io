/**
 * Display-only derived football stats (never written to players.season_stats or weekly JSON).
 */

export function completionPct(completions: number | null, attempts: number | null): number | null {
  if (attempts === null || attempts === undefined || attempts <= 0) return null
  if (completions === null || completions === undefined) return null
  return Math.round((completions / attempts) * 1000) / 10
}

export function yardsPerAttempt(yards: number | null, attempts: number | null): number | null {
  if (attempts === null || attempts === undefined || attempts <= 0) return null
  if (yards === null || yards === undefined) return null
  return Math.round((yards / attempts) * 10) / 10
}

export function yardsPerCarry(yards: number | null, carries: number | null): number | null {
  return yardsPerAttempt(yards, carries)
}

export function yardsPerReception(yards: number | null, receptions: number | null): number | null {
  return yardsPerAttempt(yards, receptions)
}

export function catchPct(receptions: number | null, targets: number | null): number | null {
  return completionPct(receptions, targets)
}

export function totalTackles(solo: number | null, assisted: number | null): number | null {
  const s = solo ?? 0
  const a = assisted ?? 0
  if (solo === null && assisted === null) return null
  return s + a
}

export function avgPuntYards(puntYards: number | null, punts: number | null): number | null {
  return yardsPerAttempt(puntYards, punts)
}

export function fgPct(made: number | null, att: number | null): number | null {
  return completionPct(made, att)
}

export function xpPct(made: number | null, att: number | null): number | null {
  return completionPct(made, att)
}

export function kickReturnAvg(yards: number | null, returns: number | null): number | null {
  return yardsPerAttempt(yards, returns)
}

export function puntReturnAvg(yards: number | null, returns: number | null): number | null {
  return yardsPerAttempt(yards, returns)
}
