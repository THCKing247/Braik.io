/**
 * Lightweight checks for messaging thread rules (no DB).
 * Run: npx tsx tests/messaging-thread-create-validation.test.ts
 */
import { validateThreadComposition, getMessagingPermissions } from "../lib/enforcement/messaging-permissions"
import { profileRoleToMessagingRole } from "../lib/messaging/thread-create-validation"

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exit(1)
  }
}

// profileRoleToMessagingRole
assert(profileRoleToMessagingRole("head_coach") === "HEAD_COACH", "head_coach maps to HEAD_COACH")
assert(profileRoleToMessagingRole("assistant_coach") === "ASSISTANT_COACH", "assistant_coach maps")
assert(profileRoleToMessagingRole("parent") === "PARENT", "parent maps")
assert(profileRoleToMessagingRole("player") === "PLAYER", "player maps")
assert(profileRoleToMessagingRole("athletic_director") === "HEAD_COACH", "AD maps to HC for messaging")

// Players cannot create threads
assert(getMessagingPermissions("PLAYER").canCreateThread() === false, "player cannot create thread")

// Parent + player without coach
const badParentPlayer = validateThreadComposition("HEAD_COACH", [
  { role: "PARENT", type: "parent" },
  { role: "PLAYER", type: "player" },
])
assert(badParentPlayer.valid === false, "parent+player without coach rejected")

const okWithCoach = validateThreadComposition("HEAD_COACH", [
  { role: "HEAD_COACH", type: "coach" },
  { role: "PARENT", type: "parent" },
  { role: "PLAYER", type: "player" },
])
assert(okWithCoach.valid === true, "parent+player+coach allowed for HC-created thread")

console.log("messaging-thread-create-validation: OK")
