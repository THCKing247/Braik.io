import assert from "node:assert"
import { effectiveVideoClipsProductEnabled } from "@/lib/video/resolve-video-clips-access"

assert.strictEqual(
  effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: true,
    organizationVideoClipsEnabled: true,
  }),
  true
)
assert.strictEqual(
  effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: true,
    organizationVideoClipsEnabled: false,
  }),
  false
)
assert.strictEqual(
  effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: true,
    organizationVideoClipsEnabled: null,
  }),
  true
)
assert.strictEqual(
  effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: true,
    organizationVideoClipsEnabled: true,
    athleticDepartmentVideoClipsEnabled: null,
  }),
  true
)
assert.strictEqual(
  effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: true,
    organizationVideoClipsEnabled: true,
    athleticDepartmentVideoClipsEnabled: false,
  }),
  false
)

console.log("video-clips-effective tests passed")
