/**
 * Formation-based depth chart: preset types and configs.
 * Assignments are stored by playerId only; player data is resolved from roster at render time.
 * Assignments are isolated per formation: offense/defense by formation id, special teams by specialTeamType.
 * Legacy entries with formation null are not shown in formation-specific views; re-assign in the desired formation if needed.
 *
 * Layout: presets can use a row-based layout (rows[]) for football-style positioning. Each row has
 * alignment (center, spread, etc.) and rowType for visual grouping. Slots are ordered within each row.
 * If rows are present, they are the source of truth; otherwise legacy gridRow/gridCol on slots is used.
 */

export type DepthLevel = 1 | 2 | 3

/** Single slot in a formation (position column with 1–3 depth strings). */
export interface FormationSlot {
  /** Stable key for assignments and save/load; never change. */
  slotKey: string
  /** Default display label (e.g. "WR", "LB"); used when no alias and no custom label. */
  displayLabel: string
  /** Optional coach-friendly alias (e.g. "X", "Mike", "Holder"); shown as primary when no custom label. */
  alias?: string | null
  /** Allowed position group(s) for this slot (e.g. "QB", "WR"); used for eligibility and optional secondary label. */
  positionGroup: string | null
  /** Legacy: used only when preset has no rows; row index for layout. */
  gridRow?: number
  /** Legacy: used only when preset has no rows; column index within row. */
  gridCol?: number
  depthLevels: DepthLevel[]
}

/** Alignment of slots within a formation row. */
export type RowAlignment = "center" | "spread" | "left" | "right"

/** Semantic row type for spacing and visual grouping (e.g. trench, backfield, skill). */
export type RowType =
  | "line"      // OL / DL trench
  | "skill"     // WR / DB wide
  | "backfield" // QB / RB / FB
  | "front"     // DL
  | "second"    // LB
  | "secondary" // DB
  | "default"

/** One row in a formation: slots and how they are laid out. */
export interface FormationRow {
  id?: string
  alignment: RowAlignment
  rowType?: RowType
  slots: FormationSlot[]
}

/** Formation preset with optional display metadata. Supports row-based layout for football-style rendering. */
export interface FormationPreset {
  id: string
  name: string
  side: "offense" | "defense" | "special_teams"
  /** Legacy: flat slots when no rows; otherwise derived from rows. */
  slots: FormationSlot[]
  /** Row-based layout; when present, grid uses this and ignores gridRow/gridCol on slots. */
  rows?: FormationRow[]
  subtitle?: string
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

/** Returns flat list of all slots in a preset (from rows or legacy slots). */
export function getFormationSlots(preset: FormationPreset): FormationSlot[] {
  if (preset.rows?.length) return preset.rows.flatMap((r) => r.slots)
  return preset.slots ?? []
}

function slot(
  slotKey: string,
  displayLabel: string,
  positionGroup: string | null,
  alias?: string | null,
  gridRow?: number,
  gridCol?: number
): FormationSlot {
  return { slotKey, displayLabel, positionGroup, alias: alias ?? undefined, gridRow, gridCol, depthLevels: [1, 2, 3] }
}

function row(alignment: RowAlignment, rowType: RowType | undefined, ...slots: FormationSlot[]): FormationRow {
  return { alignment, rowType, slots }
}

// —— Offense ——
const OFFENSE_SPREAD: FormationPreset = {
  id: "spread",
  name: "Spread",
  side: "offense",
  sortOrder: 0,
  subtitle: "4 WR set",
  slots: [],
  rows: [
    row("spread", "skill", slot("WR1", "WR", "WR", "X"), slot("WR2", "WR", "WR", "Z")),
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL")),
    row("center", "backfield", slot("QB", "QB", "QB")),
    row("center", "backfield", slot("RB", "RB", "RB")),
    row("spread", "skill", slot("WR3", "WR", "WR", "H"), slot("WR4", "WR", "WR", "Y")),
  ],
}

const OFFENSE_PRO: FormationPreset = {
  id: "pro",
  name: "Pro",
  side: "offense",
  sortOrder: 1,
  subtitle: "Pro style",
  slots: [],
  rows: [
    row("spread", "skill", slot("WR1", "WR", "WR", "X"), slot("WR2", "WR", "WR", "Z")),
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL"), slot("TE", "TE", "TE", "Y")),
    row("center", "backfield", slot("QB", "QB", "QB")),
    row("center", "backfield", slot("RB", "RB", "RB")),
  ],
}

const OFFENSE_TRIPS: FormationPreset = {
  id: "trips",
  name: "Trips",
  side: "offense",
  sortOrder: 2,
  subtitle: "3 WR one side",
  slots: [],
  rows: [
    row("spread", "skill", slot("WR1", "WR", "WR", "X"), slot("WR2", "WR", "WR", "Z"), slot("WR3", "WR", "WR", "H")),
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL"), slot("TE", "TE", "TE", "Y")),
    row("center", "backfield", slot("QB", "QB", "QB")),
    row("center", "backfield", slot("RB", "RB", "RB")),
  ],
}

const OFFENSE_EMPTY: FormationPreset = {
  id: "empty",
  name: "Empty",
  side: "offense",
  sortOrder: 3,
  subtitle: "5 WR, no back",
  slots: [],
  rows: [
    row("spread", "skill", slot("WR1", "WR", "WR", "X"), slot("WR2", "WR", "WR", "H"), slot("WR3", "WR", "WR", "Y"), slot("WR4", "WR", "WR", "Z"), slot("WR5", "WR", "WR", "F")),
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL")),
    row("center", "backfield", slot("QB", "QB", "QB")),
  ],
}

const OFFENSE_IFORM: FormationPreset = {
  id: "i_form",
  name: "I-Form",
  side: "offense",
  sortOrder: 4,
  subtitle: "FB + RB",
  slots: [],
  rows: [
    row("spread", "skill", slot("WR1", "WR", "WR", "X"), slot("WR2", "WR", "WR", "Z")),
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL"), slot("TE", "TE", "TE", "Y")),
    row("center", "backfield", slot("QB", "QB", "QB")),
    row("center", "backfield", slot("FB", "FB", "RB"), slot("RB", "RB", "RB")),
  ],
}

// —— Defense ——
const DEFENSE_43: FormationPreset = {
  id: "4-3",
  name: "4-3",
  side: "defense",
  sortOrder: 0,
  subtitle: "4 DL, 3 LB",
  slots: [],
  rows: [
    row("center", "front", slot("DE", "DE", "DL"), slot("DT1", "DT", "DL"), slot("DT2", "DT", "DL"), slot("DE2", "DE", "DL")),
    row("center", "second", slot("OLB", "OLB", "LB", "Sam"), slot("MLB", "MLB", "LB", "Mike"), slot("OLB2", "OLB", "LB", "Will")),
    row("spread", "secondary", slot("CB1", "CB", "DB"), slot("S1", "S", "DB", "FS"), slot("S2", "S", "DB", "SS"), slot("CB2", "CB", "DB")),
  ],
}

const DEFENSE_34: FormationPreset = {
  id: "3-4",
  name: "3-4",
  side: "defense",
  sortOrder: 1,
  subtitle: "3 DL, 4 LB",
  slots: [],
  rows: [
    row("center", "front", slot("DE", "DE", "DL"), slot("NT", "NT", "DL"), slot("DE2", "DE", "DL")),
    row("center", "second", slot("OLB", "OLB", "LB", "Sam"), slot("ILB1", "ILB", "LB", "Mike"), slot("ILB2", "ILB", "LB", "Will"), slot("OLB2", "OLB", "LB", "Jack")),
    row("spread", "secondary", slot("CB1", "CB", "DB"), slot("S1", "S", "DB", "FS"), slot("S2", "S", "DB", "SS"), slot("CB2", "CB", "DB")),
  ],
}

const DEFENSE_NICKEL: FormationPreset = {
  id: "nickel",
  name: "Nickel",
  side: "defense",
  sortOrder: 2,
  subtitle: "5 DB",
  slots: [],
  rows: [
    row("center", "front", slot("DE", "DE", "DL"), slot("DT1", "DT", "DL"), slot("DT2", "DT", "DL"), slot("DE2", "DE", "DL")),
    row("center", "second", slot("ILB1", "ILB", "LB", "Mike"), slot("ILB2", "ILB", "LB", "Will")),
    row("spread", "secondary", slot("CB1", "CB", "DB"), slot("NB", "NB", "DB"), slot("S1", "S", "DB", "FS"), slot("S2", "S", "DB", "SS"), slot("CB2", "CB", "DB")),
  ],
}

const DEFENSE_DIME: FormationPreset = {
  id: "dime",
  name: "Dime",
  side: "defense",
  sortOrder: 3,
  subtitle: "6 DB",
  slots: [],
  rows: [
    row("center", "front", slot("DE", "DE", "DL"), slot("DT", "DT", "DL"), slot("DE2", "DE", "DL")),
    row("center", "second", slot("ILB1", "ILB", "LB", "Mike"), slot("ILB2", "ILB", "LB", "Will")),
    row("spread", "secondary", slot("CB1", "CB", "DB"), slot("CB2", "CB", "DB"), slot("S1", "S", "DB", "FS"), slot("S2", "S", "DB", "SS"), slot("CB3", "CB", "DB", "Dime"), slot("CB4", "CB", "DB")),
  ],
}

// —— Special Teams ——
const ST_RETURN_UNIT: FormationPreset = {
  id: "kick_return",
  name: "Return Unit",
  side: "special_teams",
  sortOrder: 0,
  subtitle: "Kick / punt return",
  slots: [],
  rows: [
    row("center", "default", slot("F1", "F1", null), slot("F2", "F2", null), slot("F3", "F3", null), slot("F4", "F4", null), slot("F5", "F5", null), slot("B1", "B1", null, "Upback")),
    row("center", "default", slot("B2", "B2", null), slot("B3", "B3", null), slot("B4", "B4", null)),
    row("center", "default", slot("KR1", "KR", null, "Returner"), slot("KR2", "KR", null)),
  ],
}

const ST_FIELD_GOAL: FormationPreset = {
  id: "field_goal",
  name: "Field Goal / PAT",
  side: "special_teams",
  sortOrder: 1,
  subtitle: "Kick unit",
  slots: [],
  rows: [
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL"), slot("TE", "TE", "TE", "Wing")),
    row("center", "default", slot("LS", "LS", "OL", "LS"), slot("Holder", "H", null, "Holder"), slot("K", "K", null)),
  ],
}

const ST_PUNT: FormationPreset = {
  id: "punt",
  name: "Punt",
  side: "special_teams",
  sortOrder: 2,
  subtitle: "Punt unit",
  slots: [],
  rows: [
    row("center", "line", slot("LT", "LT", "OL"), slot("LG", "LG", "OL"), slot("C", "C", "OL"), slot("RG", "RG", "OL"), slot("RT", "RT", "OL"), slot("LS", "LS", "OL", "LS")),
    row("center", "default", slot("P", "P", null), slot("Wing1", "Wing", null, "PP"), slot("Wing2", "Wing", null)),
    row("spread", "default", slot("Gunner1", "Gunner", null, "Gunner"), slot("Gunner2", "Gunner", null, "Gunner")),
  ],
}

const ST_KICKOFF_RETURN: FormationPreset = {
  id: "kickoff_return",
  name: "Kickoff Return",
  side: "special_teams",
  sortOrder: 3,
  subtitle: "Return team",
  slots: [],
  rows: [
    row("center", "default", slot("L1", "L1", null), slot("L2", "L2", null), slot("L3", "L3", null), slot("L4", "L4", null), slot("L5", "L5", null), slot("R1", "R1", null)),
    row("center", "default", slot("R2", "R2", null), slot("R3", "R3", null), slot("R4", "R4", null)),
    row("center", "default", slot("KR1", "KR", null, "Returner"), slot("KR2", "KR", null)),
  ],
}

const ST_KICKOFF: FormationPreset = {
  id: "kickoff",
  name: "Kickoff Coverage",
  side: "special_teams",
  sortOrder: 4,
  subtitle: "Coverage unit",
  slots: [],
  rows: [
    row("center", "default", slot("K", "K", null)),
    row("center", "default", slot("L1", "L1", null), slot("L2", "L2", null), slot("L3", "L3", null), slot("L4", "L4", null), slot("L5", "L5", null), slot("R1", "R1", null), slot("R2", "R2", null), slot("R3", "R3", null), slot("R4", "R4", null), slot("R5", "R5", null)),
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
