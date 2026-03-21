import Stripe from "stripe"

let stripeSingleton: Stripe | null = null

/** Server-only Stripe client. Requires STRIPE_SECRET_KEY. */
export function getStripeServer(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    return null
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, { typescript: true })
  }
  return stripeSingleton
}
