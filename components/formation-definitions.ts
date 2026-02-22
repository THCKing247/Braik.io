// Formation definitions for list-first depth chart
// These define which positions appear in each formation and their display order

export interface FormationPosition {
  position: string
  label: string
}

export interface FormationDefinition {
  name: string
  positions: FormationPosition[]
}

// Offensive Formations
export const OFFENSIVE_FORMATIONS: Record<string, FormationDefinition> = {
  pro_style: {
    name: "Pro Style",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "TE", label: "TE" },
      { position: "QB", label: "QB" },
      { position: "RB", label: "RB" },
      { position: "WRX", label: "WR X" },
      { position: "WRZ", label: "WR Z" },
    ],
  },
  i_formation: {
    name: "I-Formation",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "TE", label: "TE" },
      { position: "QB", label: "QB" },
      { position: "FB", label: "FB" },
      { position: "RB", label: "HB" },
      { position: "WRX", label: "WR X" },
      { position: "WRZ", label: "WR Z" },
    ],
  },
  shotgun_twins: {
    name: "Shotgun (Twins)",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "QB", label: "QB" },
      { position: "RB", label: "RB" },
      { position: "H", label: "H" },
      { position: "Y", label: "Y" },
      { position: "WR1", label: "WR" },
      { position: "WR2", label: "WR" },
      { position: "WR3", label: "WR" },
    ],
  },
  shotgun_one_back: {
    name: "Shotgun (One Back)",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "QB", label: "QB" },
      { position: "RB", label: "RB" },
      { position: "H", label: "H" },
      { position: "Y", label: "Y" },
      { position: "X", label: "X" },
      { position: "WRZ", label: "Z" },
    ],
  },
  spread: {
    name: "Spread",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "QB", label: "QB" },
      { position: "RB", label: "RB" },
      { position: "WR1", label: "WR" },
      { position: "WR2", label: "WR" },
      { position: "WR3", label: "WR" },
      { position: "WR4", label: "WR" },
    ],
  },
  trips: {
    name: "Trips",
    positions: [
      { position: "LT", label: "LT" },
      { position: "LG", label: "LG" },
      { position: "C", label: "C" },
      { position: "RG", label: "RG" },
      { position: "RT", label: "RT" },
      { position: "QB", label: "QB" },
      { position: "RB", label: "RB" },
      { position: "TE", label: "TE" },
      { position: "WR1", label: "WR" },
      { position: "WR2", label: "WR" },
      { position: "WR3", label: "WR" },
    ],
  },
}

// Defensive Formations
export const DEFENSIVE_FORMATIONS: Record<string, FormationDefinition> = {
  "4-3": {
    name: "4-3",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "MLB", label: "MLB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "4-4": {
    name: "4-4",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "46_bear": {
    name: "46 Bear",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "3-4": {
    name: "3-4",
    positions: [
      { position: "DE", label: "DE" },
      { position: "NT", label: "NT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "3-3-5": {
    name: "3-3-5",
    positions: [
      { position: "DE", label: "DE" },
      { position: "NT", label: "NT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "4-2": {
    name: "4-2",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "2-4": {
    name: "2-4",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "5-3": {
    name: "5-3",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "3-5": {
    name: "3-5",
    positions: [
      { position: "DE", label: "DE" },
      { position: "NT", label: "NT" },
      { position: "DE", label: "DE" },
      { position: "OLB", label: "OLB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "OLB", label: "OLB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  "4-2-5": {
    name: "4-2-5",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
      { position: "CB", label: "CB" },
    ],
  },
  nickel: {
    name: "Nickel",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "ILB", label: "ILB" },
      { position: "ILB", label: "ILB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
    ],
  },
  dime: {
    name: "Dime",
    positions: [
      { position: "DE", label: "DE" },
      { position: "DT", label: "DT" },
      { position: "DT", label: "DT" },
      { position: "DE", label: "DE" },
      { position: "ILB", label: "ILB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "S", label: "S" },
      { position: "S", label: "S" },
    ],
  },
}

// Special Teams Formations
export const SPECIAL_TEAMS_FORMATIONS: Record<string, FormationDefinition> = {
  kickoff: {
    name: "Kickoff",
    positions: [
      { position: "K", label: "K" },
    ],
  },
  kick_return: {
    name: "Kick Return",
    positions: [
      { position: "KR", label: "KR" },
      { position: "UP", label: "UP" },
    ],
  },
  punt: {
    name: "Punt",
    positions: [
      { position: "P", label: "P" },
      { position: "LS", label: "LS" },
    ],
  },
  punt_return: {
    name: "Punt Return",
    positions: [
      { position: "PR", label: "PR" },
      { position: "UP", label: "UP" },
    ],
  },
  field_goal: {
    name: "Field Goal",
    positions: [
      { position: "K", label: "K" },
      { position: "LS", label: "LS" },
      { position: "H", label: "H" },
    ],
  },
  field_goal_block: {
    name: "Field Goal Block",
    positions: [
      { position: "B", label: "B" },
    ],
  },
}
