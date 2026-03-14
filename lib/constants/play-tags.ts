/** Starter tags for play tagging. Coaches can also add custom tags. */
export const STARTER_PLAY_TAGS = [
  "Run",
  "Pass",
  "RPO",
  "Red Zone",
  "3rd Down",
  "Shot Play",
  "2 Minute",
  "Goal Line",
  "Screen",
  "Favorite",
] as const

export type StarterPlayTag = (typeof STARTER_PLAY_TAGS)[number]
