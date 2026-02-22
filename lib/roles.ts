/** Role names used for permission checks and membership */
export const ROLES = {
  HEAD_COACH: "HEAD_COACH",
  ASSISTANT_COACH: "ASSISTANT_COACH",
  PLAYER: "PLAYER",
  PARENT: "PARENT",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]
