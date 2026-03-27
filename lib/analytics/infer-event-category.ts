export type ProductEventCategory = "marketing" | "product" | "coach_b" | "billing"

export function inferEventCategory(eventName: string): ProductEventCategory {
  const e = eventName.toLowerCase()
  if (e.startsWith("braik.coach_b.") || e.includes("coach_b")) {
    return "coach_b"
  }
  if (e.startsWith("braik.billing.") || e.includes("billing.") || e.includes("stripe")) {
    return "billing"
  }
  if (
    e.startsWith("viewed_") ||
    e.startsWith("clicked_") ||
    e.startsWith("submitted_lead") ||
    e.startsWith("submitted_waitlist") ||
    e.includes("pricing") ||
    e.includes("cta")
  ) {
    return "marketing"
  }
  return "product"
}
