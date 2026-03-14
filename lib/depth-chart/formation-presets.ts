/**
 * Formation-based depth chart: preset types and configs.
 * Assignments are stored by playerId only; player data is resolved from roster at render time.
 * Assignments are isolated per formation: offense/defense by formation id, special teams by specialTeamType.
 * Legacy entries with formation null are not shown in formation-specific views; re-assign in the desired formation if needed.
 */

export type DepthLevel = 1 | 2 | 3

/** Single slot in a formation (position column with 1–3 depth strings). */
export interface FormationSlot {
  slotKey: string
  displayLabel: string
  /** Allowed position group(s) for this slot (e.g. "QB", "WR"). */
  positionGroup: string | null
  gridRow: number
  gridCol: number
  depthLevels: DepthLevel[]
}

/** Formation preset with optional display metadata. */
export interface FormationPreset {
  id: string
  name: string
  side: "offense" | "defense" | "special_teams"
  slots: FormationSlot[]
  /** Optional short subtitle for the selector. */
  subtitle?: string
  /** Sort order within the side (lower first). */
  sortOrder?: number
}

/** Assignment stored by slot key and depth; player resolved from roster. Duplicate assignment: drop handler removes the player from any other slot in the same unit/formation first. */
export interface DepthAssignment {
  id?: string
  unit: string
  position: string
  string: number
  playerId: string | null
  formation?: string | null
  specialTeamType?: string | null
}

function slot(
  slotKey: string,
  displayLabel: string,
  positionGroup: string | null,
  gridRow: number,
  gridCol: number
): FormationSlot {
  return { slotKey, displayLabel, positionGroup, gridRow, gridCol, depthLevels: [1, 2, 3] }
}

// —— Offense ——
const OFFENSE_SPREAD: FormationPreset = {
  id: "spread",
  name: "Spread",
  side: "offense",
  sortOrder: 0,
  subtitle: "4 WR set",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("QB", "QB", "QB", 0, 5),
    slot("RB", "RB", "RB", 1, 0),
    slot("WR1", "WR", "WR", 1, 1),
    slot("WR2", "WR", "WR", 1, 2),
    slot("WR3", "WR", "WR", 1, 3),
    slot("WR4", "WR", "WR", 1, 4),
  ],
}

const OFFENSE_PRO: FormationPreset = {
  id: "pro",
  name: "Pro",
  side: "offense",
  sortOrder: 1,
  subtitle: "Pro style",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("TE", "TE", "TE", 0, 5),
    slot("QB", "QB", "QB", 1, 0),
    slot("RB", "RB", "RB", 1, 1),
    slot("WR1", "WR", "WR", 1, 2),
    slot("WR2", "WR", "WR", 1, 3),
  ],
}

const OFFENSE_TRIPS: FormationPreset = {
  id: "trips",
  name: "Trips",
  side: "offense",
  sortOrder: 2,
  subtitle: "3 WR one side",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("TE", "TE", "TE", 0, 5),
    slot("QB", "QB", "QB", 1, 0),
    slot("RB", "RB", "RB", 1, 1),
    slot("WR1", "WR", "WR", 1, 2),
    slot("WR2", "WR", "WR", 1, 3),
    slot("WR3", "WR", "WR", 1, 4),
  ],
}

const OFFENSE_EMPTY: FormationPreset = {
  id: "empty",
  name: "Empty",
  side: "offense",
  sortOrder: 3,
  subtitle: "5 WR, no back",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("QB", "QB", "QB", 0, 5),
    slot("WR1", "WR", "WR", 1, 0),
    slot("WR2", "WR", "WR", 1, 1),
    slot("WR3", "WR", "WR", 1, 2),
    slot("WR4", "WR", "WR", 1, 3),
    slot("WR5", "WR", "WR", 1, 4),
  ],
}

const OFFENSE_IFORM: FormationPreset = {
  id: "i_form",
  name: "I-Form",
  side: "offense",
  sortOrder: 4,
  subtitle: "FB + RB",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("TE", "TE", "TE", 0, 5),
    slot("QB", "QB", "QB", 1, 0),
    slot("FB", "FB", "RB", 1, 1),
    slot("RB", "RB", "RB", 1, 2),
    slot("WR1", "WR", "WR", 1, 3),
    slot("WR2", "WR", "WR", 1, 4),
  ],
}

// —— Defense ——
const DEFENSE_43: FormationPreset = {
  id: "4-3",
  name: "4-3",
  side: "defense",
  sortOrder: 0,
  subtitle: "4 DL, 3 LB",
  slots: [
    slot("DE", "DE", "DL", 0, 0),
    slot("DT1", "DT", "DL", 0, 1),
    slot("DT2", "DT", "DL", 0, 2),
    slot("DE2", "DE", "DL", 0, 3),
    slot("OLB", "OLB", "LB", 0, 4),
    slot("MLB", "MLB", "LB", 0, 5),
    slot("OLB2", "OLB", "LB", 1, 0),
    slot("CB1", "CB", "DB", 1, 1),
    slot("CB2", "CB", "DB", 1, 2),
    slot("S1", "S", "DB", 1, 3),
    slot("S2", "S", "DB", 1, 4),
  ],
}

const DEFENSE_34: FormationPreset = {
  id: "3-4",
  name: "3-4",
  side: "defense",
  sortOrder: 1,
  subtitle: "3 DL, 4 LB",
  slots: [
    slot("DE", "DE", "DL", 0, 0),
    slot("NT", "NT", "DL", 0, 1),
    slot("DE2", "DE", "DL", 0, 2),
    slot("OLB", "OLB", "LB", 0, 3),
    slot("ILB1", "ILB", "LB", 0, 4),
    slot("ILB2", "ILB", "LB", 0, 5),
    slot("OLB2", "OLB", "LB", 1, 0),
    slot("CB1", "CB", "DB", 1, 1),
    slot("CB2", "CB", "DB", 1, 2),
    slot("S1", "S", "DB", 1, 3),
    slot("S2", "S", "DB", 1, 4),
  ],
}

const DEFENSE_NICKEL: FormationPreset = {
  id: "nickel",
  name: "Nickel",
  side: "defense",
  sortOrder: 2,
  subtitle: "5 DB",
  slots: [
    slot("DE", "DE", "DL", 0, 0),
    slot("DT1", "DT", "DL", 0, 1),
    slot("DT2", "DT", "DL", 0, 2),
    slot("DE2", "DE", "DL", 0, 3),
    slot("ILB1", "ILB", "LB", 0, 4),
    slot("ILB2", "ILB", "LB", 0, 5),
    slot("CB1", "CB", "DB", 1, 0),
    slot("CB2", "CB", "DB", 1, 1),
    slot("NB", "NB", "DB", 1, 2),
    slot("S1", "S", "DB", 1, 3),
    slot("S2", "S", "DB", 1, 4),
  ],
}

const DEFENSE_DIME: FormationPreset = {
  id: "dime",
  name: "Dime",
  side: "defense",
  sortOrder: 3,
  subtitle: "6 DB",
  slots: [
    slot("DE", "DE", "DL", 0, 0),
    slot("DT", "DT", "DL", 0, 1),
    slot("DE2", "DE", "DL", 0, 2),
    slot("ILB1", "ILB", "LB", 0, 3),
    slot("ILB2", "ILB", "LB", 0, 4),
    slot("CB1", "CB", "DB", 1, 0),
    slot("CB2", "CB", "DB", 1, 1),
    slot("CB3", "CB", "DB", 1, 2),
    slot("CB4", "CB", "DB", 1, 3),
    slot("S1", "S", "DB", 1, 4),
    slot("S2", "S", "DB", 1, 5),
  ],
}

// —— Special Teams ——
const ST_RETURN_UNIT: FormationPreset = {
  id: "kick_return",
  name: "Return Unit",
  side: "special_teams",
  sortOrder: 0,
  subtitle: "Kick / punt return",
  slots: [
    slot("F1", "F1", null, 0, 0),
    slot("F2", "F2", null, 0, 1),
    slot("F3", "F3", null, 0, 2),
    slot("F4", "F4", null, 0, 3),
    slot("F5", "F5", null, 0, 4),
    slot("B1", "B1", null, 0, 5),
    slot("B2", "B2", null, 1, 0),
    slot("B3", "B3", null, 1, 1),
    slot("B4", "B4", null, 1, 2),
    slot("KR1", "KR", null, 1, 3),
    slot("KR2", "KR", null, 1, 4),
  ],
}

const ST_FIELD_GOAL: FormationPreset = {
  id: "field_goal",
  name: "Field Goal / PAT",
  side: "special_teams",
  sortOrder: 1,
  subtitle: "Kick unit",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("TE", "TE", "TE", 0, 5),
    slot("LS", "LS", "OL", 1, 0),
    slot("Holder", "H", null, 1, 1),
    slot("K", "K", null, 1, 2),
  ],
}

const ST_PUNT: FormationPreset = {
  id: "punt",
  name: "Punt",
  side: "special_teams",
  sortOrder: 2,
  subtitle: "Punt unit",
  slots: [
    slot("LT", "LT", "OL", 0, 0),
    slot("LG", "LG", "OL", 0, 1),
    slot("C", "C", "OL", 0, 2),
    slot("RG", "RG", "OL", 0, 3),
    slot("RT", "RT", "OL", 0, 4),
    slot("LS", "LS", "OL", 0, 5),
    slot("P", "P", null, 1, 0),
    slot("Wing1", "Wing", null, 1, 1),
    slot("Wing2", "Wing", null, 1, 2),
    slot("Gunner1", "Gunner", null, 1, 3),
    slot("Gunner2", "Gunner", null, 1, 4),
  ],
}

const ST_KICKOFF_RETURN: FormationPreset = {
  id: "kickoff_return",
  name: "Kickoff Return",
  side: "special_teams",
  sortOrder: 3,
  subtitle: "Return team",
  slots: [
    slot("L1", "L1", null, 0, 0),
    slot("L2", "L2", null, 0, 1),
    slot("L3", "L3", null, 0, 2),
    slot("L4", "L4", null, 0, 3),
    slot("L5", "L5", null, 0, 4),
    slot("R1", "R1", null, 0, 5),
    slot("R2", "R2", null, 1, 0),
    slot("R3", "R3", null, 1, 1),
    slot("R4", "R4", null, 1, 2),
    slot("KR1", "KR", null, 1, 3),
    slot("KR2", "KR", null, 1, 4),
  ],
}

const ST_KICKOFF: FormationPreset = {
  id: "kickoff",
  name: "Kickoff Coverage",
  side: "special_teams",
  sortOrder: 4,
  subtitle: "Coverage unit",
  slots: [
    slot("L1", "L1", null, 0, 0),
    slot("L2", "L2", null, 0, 1),
    slot("L3", "L3", null, 0, 2),
    slot("L4", "L4", null, 0, 3),
    slot("L5", "L5", null, 0, 4),
    slot("K", "K", null, 0, 5),
    slot("R1", "R1", null, 1, 0),
    slot("R2", "R2", null, 1, 1),
    slot("R3", "R3", null, 1, 2),
    slot("R4", "R4", null, 1, 3),
    slot("R5", "R5", null, 1, 4),
  ],
}

// —— Preset maps and defaults ——
export const OFFENSE_PRESETS: Record<string, FormationPreset> = {
  spread: OFFENSE_SPREAD,
  pro: OFFENSE_PRO,
  trips: OFFENSE_TRIPS,
  empty: OFFENSE_EMPTY,
  i_form: OFFENSE_IFORM,
}

export const DEFENSE_PRESETS: Record<string, FormationPreset> = {
  "4-3": DEFENSE_43,
  "3-4": DEFENSE_34,
  nickel: DEFENSE_NICKEL,
  dime: DEFENSE_DIME,
}

export const SPECIAL_TEAMS_PRESETS: Record<string, FormationPreset> = {
  kick_return: ST_RETURN_UNIT,
  field_goal: ST_FIELD_GOAL,
  punt: ST_PUNT,
  kickoff_return: ST_KICKOFF_RETURN,
  kickoff: ST_KICKOFF,
}

export const DEFAULT_PRESET_BY_SIDE: Record<"offense" | "defense" | "special_teams", string> = {
  offense: "spread",
  defense: "4-3",
  special_teams: "kick_return",
}

function sortPresets(presets: FormationPreset[]): FormationPreset[] {
  return [...presets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
}

export function getPresetsForSide(side: "offense" | "defense" | "special_teams"): FormationPreset[] {
  if (side === "offense") return sortPresets(Object.values(OFFENSE_PRESETS))
  if (side === "defense") return sortPresets(Object.values(DEFENSE_PRESETS))
  return sortPresets(Object.values(SPECIAL_TEAMS_PRESETS))
}

export function getPreset(side: "offense" | "defense" | "special_teams", presetId: string): FormationPreset | null {
  if (side === "offense") return OFFENSE_PRESETS[presetId] ?? null
  if (side === "defense") return DEFENSE_PRESETS[presetId] ?? null
  return SPECIAL_TEAMS_PRESETS[presetId] ?? null
}
