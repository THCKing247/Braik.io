export type Role = "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"

export type SideOfBall = "offense" | "defense" | "special_teams"

export type PlaybookVisibility = {
  offense: boolean
  defense: boolean
  specialTeams: boolean
}

export type ShapeKind = 
  | "OFFENSE_CIRCLE" 
  | "CENTER_SQUARE" 
  | "DEFENSE_TRIANGLE"
  | "SPECIAL_TEAMS_CIRCLE"
  | "SPECIAL_TEAMS_SQUARE"

export type Shape = {
  id: string
  kind: ShapeKind
  xYards: number
  yYards: number
  label: string
  locked?: boolean // For plays: whether this template shape is locked
  technique?: string // For defense
  gap?: string // For defense
}

export type Path = {
  id: string
  type: "route" | "run" | "block" | "man" | "pursuit"
  points: Array<{ xYards: number; yYards: number; t: number }>
  attachedToShapeId?: string
  targetShapeId?: string // For man coverage
}

export type Zone = {
  id: string
  xYards: number
  yYards: number
  size: "small" | "large"
  type: "hook" | "spot" | "deep"
}

export type TemplateData = {
  fieldView: "HALF"
  shapes: Shape[]
  paths: [] // Templates must have empty paths
}

export type PlayData = {
  fieldView: "HALF"
  shapes: Shape[] // Includes template shapes + optional opponent shapes
  paths: Path[]
  zones: Zone[]
}

export type PlaybookNodeKind = 
  | "ROOT_OFFENSE" 
  | "ROOT_DEFENSE" 
  | "ROOT_SPECIAL_TEAMS"
  | "FORMATION_TEMPLATE"
  | "SUBFORMATION_TEMPLATE"
  | "PLAY"

export type PlaybookNode = {
  id: string
  kind: PlaybookNodeKind
  name: string
  parentId: string | null
  childrenIds: string[]
  side: SideOfBall
  createdAt: number
  updatedAt: number
  template?: TemplateData // For FORMATION_TEMPLATE and SUBFORMATION_TEMPLATE
  playData?: PlayData // For PLAY nodes
}

export type Playbook = {
  id: string
  teamId: string
  name: string
  createdAt: number
  updatedAt: number
  visibility: PlaybookVisibility
  nodes: Record<string, PlaybookNode>
  rootBySide: Record<SideOfBall, string>
}

export type DraftTemplateKind = "FORMATION" | "SUBFORMATION"

export type DraftTemplateSession = {
  isActive: boolean
  kind: DraftTemplateKind
  side: SideOfBall
  parentFormationId?: string // Only for SUBFORMATION
  name: string
  shapes: Shape[] // Template only - no paths allowed
}

export type BuilderMode = "TEMPLATE_EDIT" | "PLAY_EDIT" | "VIEW_ONLY"

export type Tab = "LIBRARY" | "BUILDER"

// API response types for formations, sub-formations, and plays (align with DB)
export type FormationRecord = {
  id: string
  teamId: string
  playbookId: string | null
  side: SideOfBall
  name: string
  parentFormationId: string | null
  templateData: TemplateData
  createdAt: string
  updatedAt: string
}

/** Sub-formation: category under a formation (e.g. Singleback > Deuce Close). */
export type SubFormationRecord = {
  id: string
  teamId: string
  formationId: string
  side: SideOfBall
  name: string
  createdAt: string
  updatedAt: string
}

export type PlayRecord = {
  id: string
  teamId: string
  playbookId: string | null
  formationId: string | null
  subFormationId: string | null
  side: SideOfBall
  formation: string
  subFormation: string | null
  subcategory: string | null
  name: string
  canvasData: PlayCanvasData | null
  createdAt: string
  updatedAt: string
}

// Route/block point for persistence (yard coords preferred for consistency)
export type RoutePoint = { x?: number; y?: number; xYards: number; yYards: number; t: number }
export type BlockEndPoint = { x?: number; y?: number; xYards: number; yYards: number }

// Builder canvas format (players array with pixel/yard coords, zones, man coverage, routes, blocks)
// positionCode + positionNumber define football role (e.g. WR, 2 → WR2); label is display string (kept for legacy).
export type PlayCanvasData = {
  fieldView?: "HALF"
  players: Array<{
    id: string
    x?: number
    y?: number
    xYards: number
    yYards: number
    label: string
    shape: "circle" | "square" | "triangle"
    playerType?: "skill" | "lineman"
    technique?: string
    gap?: string
    route?: RoutePoint[]
    blockingLine?: BlockEndPoint
    /** Football position code (QB, WR, LT, CB, GUN, etc.). */
    positionCode?: string | null
    /** Depth/slot number for numberable positions (WR1, WR2, GUN1). */
    positionNumber?: number | null
  }>
  zones: Array<{
    id: string
    x?: number
    y?: number
    xYards?: number
    yYards?: number
    size: "small" | "large"
    type: "hook" | "spot" | "deep"
  }>
  manCoverages?: Array<{ id: string; defenderId: string; receiverId: string }>
  fieldType?: "half" | "full"
  side: SideOfBall
}
