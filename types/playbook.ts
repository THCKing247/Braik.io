/**
 * Playbook UI types: sides, builder mode, shapes, and draft session.
 */

export type SideOfBall = "offense" | "defense" | "special_teams"

export type ShapeKind =
  | "CENTER_SQUARE"
  | "OFFENSE_CIRCLE"
  | "DEFENSE_TRIANGLE"
  | "SPECIAL_TEAMS_SQUARE"
  | "SPECIAL_TEAMS_CIRCLE"

export interface Shape {
  id: string
  kind: ShapeKind
  xYards?: number
  yYards?: number
  label?: string
}

export type BuilderMode = "VIEW_ONLY" | "PLAY_EDIT" | "TEMPLATE_EDIT"

export interface DraftTemplateSession {
  isActive: boolean
  kind: "FORMATION" | "SUBFORMATION"
  side: SideOfBall
  name: string
  shapes?: Shape[]
  parentFormationId?: string
}

export type Tab = "LIBRARY" | "BUILDER"
