/**
 * Centralized notification routing utility
 * 
 * Handles deep-linking from notifications to relevant app pages.
 * This system is designed to be reusable across all modules.
 * 
 * Usage:
 * ```ts
 * const route = buildNotificationRoute(linkType, linkId, linkUrl, teamId)
 * if (route) {
 *   const url = buildNotificationUrl(route)
 *   router.push(url)
 * }
 * ```
 * 
 * Supported link types:
 * - message_thread: Routes to /dashboard/messages?threadId={linkId}
 * - event: Routes to /dashboard/schedule?eventId={linkId}
 * - roster: Routes to /dashboard/roster
 * - player: Routes to /dashboard/roster/{linkId}
 * - schedule: Routes to /dashboard/schedule
 * - document: Routes to /dashboard/documents?documentId={linkId}
 * - playbook: Routes to /dashboard/playbooks/{linkId}
 * - announcement: Routes to /dashboard/announcements?announcementId={linkId}
 * - health: Routes to /dashboard/health
 * - inventory: Routes to /dashboard/inventory
 * - settings: Routes to /dashboard/settings
 * - stats: Routes to /dashboard/stats
 * - messages: Routes to /dashboard/messages (inbox)
 * - custom: Uses linkUrl if provided
 */

export type NotificationLinkType = 
  | "message_thread"
  | "messages"
  | "event"
  | "roster"
  | "player"
  | "schedule"
  | "document"
  | "playbook"
  | "announcement"
  | "health"
  | "inventory"
  | "settings"
  | "stats"
  | "custom"

export interface NotificationRoute {
  path: string
  queryParams?: Record<string, string>
}

/**
 * Builds a route for a notification based on linkType and linkId
 * Returns null if routing is not supported
 */
export function buildNotificationRoute(
  linkType: string | null,
  linkId: string | null,
  linkUrl: string | null,
  teamId?: string
): NotificationRoute | null {
  // If linkUrl is provided and it's a full URL, use it directly
  if (linkUrl && (linkUrl.startsWith("http://") || linkUrl.startsWith("https://"))) {
    return { path: linkUrl }
  }

  // If linkUrl is provided and it's a relative path, use it
  if (linkUrl && linkUrl.startsWith("/")) {
    // Add query params if linkId is provided
    const queryParams: Record<string, string> = {}
    if (linkId) {
      // Try to infer the param name from linkType
      if (linkType === "message_thread") {
        queryParams.threadId = linkId
      } else if (linkType === "event") {
        queryParams.eventId = linkId
      } else if (linkType === "player") {
        queryParams.playerId = linkId
      } else {
        queryParams.id = linkId
      }
    }
    if (teamId) {
      queryParams.teamId = teamId
    }
    return { path: linkUrl, queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined }
  }

  const basePath = "/dashboard"
  const queryParams: Record<string, string> = {}
  if (teamId) {
    queryParams.teamId = teamId
  }

  const t = (linkType || "").toLowerCase()

  /** Section links: linkId optional */
  if (t && !linkId) {
    switch (t) {
      case "roster":
        return { path: `${basePath}/roster`, queryParams }
      case "schedule":
        return { path: `${basePath}/schedule`, queryParams }
      case "messages":
        return { path: `${basePath}/messages`, queryParams }
      case "document":
      case "documents":
        return { path: `${basePath}/documents`, queryParams }
      case "playbook":
      case "playbooks":
        return { path: `${basePath}/playbooks`, queryParams }
      case "announcement":
      case "announcements":
        return { path: `${basePath}/announcements`, queryParams }
      case "health":
        return { path: `${basePath}/health`, queryParams }
      case "inventory":
        return { path: `${basePath}/inventory`, queryParams }
      case "stats":
        return { path: `${basePath}/stats`, queryParams }
      case "settings":
        return { path: `${basePath}/settings`, queryParams }
      default:
        break
    }
  }

  if (!linkType || !linkId) {
    return null
  }

  switch (t) {
    case "message_thread":
      return {
        path: `${basePath}/messages`,
        queryParams: { ...queryParams, threadId: linkId }
      }
    
    case "event":
      return {
        path: `${basePath}/schedule`,
        queryParams: { ...queryParams, eventId: linkId }
      }
    
    case "roster":
      return {
        path: `${basePath}/roster`,
        queryParams: queryParams
      }
    
    case "player":
      return {
        path: `${basePath}/roster/${linkId}`,
        queryParams: queryParams
      }
    
    case "schedule":
      return {
        path: `${basePath}/schedule`,
        queryParams: queryParams
      }
    
    case "document":
      return {
        path: `${basePath}/documents`,
        queryParams: { ...queryParams, documentId: linkId }
      }
    
    case "playbook":
      return {
        path: `${basePath}/playbooks/${linkId}`,
        queryParams: queryParams
      }
    
    case "announcement":
      return {
        path: `${basePath}/announcements`,
        queryParams: { ...queryParams, announcementId: linkId }
      }
    
    case "health":
      return {
        path: `${basePath}/health`,
        queryParams: { ...queryParams, playerId: linkId }
      }
    
    case "inventory":
      return {
        path: `${basePath}/inventory`,
        queryParams: queryParams
      }
    
    case "stats":
      return {
        path: `${basePath}/stats`,
        queryParams: { ...queryParams, playerId: linkId }
      }
    
    case "settings":
      return {
        path: `${basePath}/settings`,
        queryParams: queryParams
      }
    
    case "custom":
      // For custom types, try to use linkUrl if available
      if (linkUrl) {
        return { path: linkUrl }
      }
      return null
    
    default:
      // Unknown linkType, try to use linkUrl if available
      if (linkUrl) {
        return { path: linkUrl }
      }
      return null
  }
}

/**
 * Builds a full URL string from a NotificationRoute
 */
export function buildNotificationUrl(route: NotificationRoute): string {
  if (!route.path) {
    return "/dashboard"
  }

  // If it's an absolute URL, return as-is
  if (route.path.startsWith("http://") || route.path.startsWith("https://")) {
    return route.path
  }

  // Build query string
  const queryString = route.queryParams
    ? "?" + new URLSearchParams(route.queryParams).toString()
    : ""

  return route.path + queryString
}
