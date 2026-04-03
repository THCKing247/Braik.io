/**
 * Safe in-app routes for voice "navigation" intents (client router).
 * Team-scoped dashboard URLs use `teamId` query param (see existing portal links).
 */
export function getCoachBNavigationHref(
  teamId: string,
  actionName: string | undefined
): string | null {
  const q = encodeURIComponent(teamId)
  switch (actionName) {
    case "open_depth_chart":
      return `/dashboard/roster?teamId=${q}&tab=depth-chart`
    case "open_schedule":
      return `/dashboard/schedule?teamId=${q}`
    case "open_messages":
      return `/dashboard/messages?teamId=${q}`
    case "open_playbooks":
      return `/dashboard/playbooks?teamId=${q}`
    default:
      return null
  }
}

export function navigationActionLabel(actionName: string | undefined): string {
  switch (actionName) {
    case "open_depth_chart":
      return "Opening the depth chart."
    case "open_schedule":
      return "Opening your schedule."
    case "open_messages":
      return "Opening messages."
    case "open_playbooks":
      return "Opening playbooks."
    default:
      return "Taking you there."
  }
}
