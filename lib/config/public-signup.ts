/**
 * Legacy “open” self-serve signup (head coach, etc.). Off by default — set `BRAIK_ALLOW_PUBLIC_SIGNUP=true` for local/dev.
 * Player team join via `teams.player_code` + `/api/player/join/*` + signup-secure player intent does not require this flag.
 */
export function isPublicSignupAllowed(): boolean {
  return process.env.BRAIK_ALLOW_PUBLIC_SIGNUP === "true"
}
