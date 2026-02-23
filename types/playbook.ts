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
