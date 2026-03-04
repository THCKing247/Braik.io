"use client"

type EventPayload = {
  event: string
  metadata?: Record<string, unknown>
}

export function trackMarketingEvent(event: string, metadata?: Record<string, unknown>) {
  const payload: EventPayload = { event, metadata }

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
    keepalive: true,
  }).catch((error) => {
    console.error("Marketing tracking failed:", error)
  })
}
