import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripeServer } from "@/lib/stripe/stripe-server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

export const runtime = "nodejs"

/**
 * Stripe webhooks — signature-verified. Persists subscription rows for later roster/billing UI.
 *
 * Expected Checkout metadata (set when creating sessions):
 * - `team_id` — required for `public.subscriptions` upsert
 * - `program_id` — optional; updates `programs.stripe_customer_id` / `stripe_subscription_id`
 *
 * Env: STRIPE_WEBHOOK_SECRET (required), STRIPE_SECRET_KEY (required for verification client).
 */
export async function POST(request: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!whSecret) {
    console.warn("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const stripe = getStripeServer()
  if (!stripe) {
    console.warn("[stripe/webhook] STRIPE_SECRET_KEY is not set")
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const raw = await request.text()
  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[stripe/webhook] signature verification failed", msg)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const teamId = session.metadata?.team_id
        const programId = session.metadata?.program_id
        const subRef = session.subscription
        const subId = typeof subRef === "string" ? subRef : subRef?.id

        if (subId && teamId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          trackProductEventServer({
            eventName: BRAIK_EVENTS.billing.stripe_webhook_subscription,
            eventCategory: "billing",
            teamId,
            metadata: {
              stripe_event: event.type,
              subscription_status: sub.status,
            },
          })
          await supabase.from("subscriptions").upsert(
            {
              team_id: teamId,
              stripe_subscription_id: sub.id,
              status: sub.status,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            },
            { onConflict: "stripe_subscription_id" }
          )
        }

        if (programId && session.customer) {
          const custId = typeof session.customer === "string" ? session.customer : session.customer.id
          const update: Record<string, unknown> = {
            stripe_customer_id: custId,
            updated_at: new Date().toISOString(),
          }
          if (subId) {
            update.stripe_subscription_id = subId
          }
          await supabase.from("programs").update(update).eq("id", programId)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        let teamId = sub.metadata?.team_id ?? null
        if (!teamId) {
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("team_id")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle()
          teamId = existing?.team_id ?? null
        }
        if (!teamId) {
          console.warn("[stripe/webhook] subscription event without resolvable team_id", sub.id)
          break
        }
        trackProductEventServer({
          eventName: BRAIK_EVENTS.billing.stripe_webhook_subscription,
          eventCategory: "billing",
          teamId,
          metadata: {
            stripe_event: event.type,
            subscription_status: sub.status,
          },
        })
        await supabase.from("subscriptions").upsert(
          {
            team_id: teamId,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: "stripe_subscription_id" }
        )
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error("[stripe/webhook] handler error", e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
