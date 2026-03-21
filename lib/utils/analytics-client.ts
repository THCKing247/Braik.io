"use client"

type EventPayload = {
  event: string
  metadata?: Record<string, unknown>
  eventCategory?: "marketing" | "product" | "coach_b" | "billing"
  teamId?: string
}

function postAnalytics(payload: EventPayload) {
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/track", blob)
      return
    }
  } catch (error) {
    console.error("Beacon tracking failed:", error)
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
    keepalive: true,
  }).catch((error) => {
    console.error("Analytics tracking failed:", error)
  })
}

export function trackMarketingEvent(event: string, metadata?: Record<string, unknown>) {
  postAnalytics({ event, metadata, eventCategory: "marketing" })
}

/** Authenticated product events (session cookie sent when using fetch/beacon same-origin). */
export function trackProductEvent(
  event: string,
  opts?: { metadata?: Record<string, unknown>; teamId?: string; eventCategory?: EventPayload["eventCategory"] }
) {
  postAnalytics({
    event,
    metadata: opts?.metadata,
    teamId: opts?.teamId,
    eventCategory: opts?.eventCategory ?? "product",
  })
}
