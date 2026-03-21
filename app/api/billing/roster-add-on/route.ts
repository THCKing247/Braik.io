import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { getStripeServer } from "@/lib/stripe/stripe-server"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

/**
 * POST /api/billing/roster-add-on
 * Scaffold for purchasing additional roster capacity (Stripe Checkout / Customer Portal).
 *
 * When implemented: create a Checkout Session with metadata `{ team_id, program_id? }`,
 * success_url / cancel_url, and line items for extra roster seats. Webhook persists subscription state.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { teamId?: string; requestedSlots?: number }
    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    const requestedSlots =
      typeof body.requestedSlots === "number" && Number.isFinite(body.requestedSlots) && body.requestedSlots > 0
        ? Math.min(500, Math.floor(body.requestedSlots))
        : null

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage_billing")

    trackProductEventServer({
      eventName: BRAIK_EVENTS.billing.roster_addon_requested,
      eventCategory: "billing",
      userId: session.user.id,
      teamId,
      role: session.user.role ?? null,
      metadata: { requested_slots: requestedSlots },
    })

    const stripe = getStripeServer()
    if (!stripe) {
      return NextResponse.json(
        {
          error: "Stripe is not configured (STRIPE_SECRET_KEY missing).",
          code: "STRIPE_NOT_CONFIGURED",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: "Checkout session not implemented yet",
        code: "BILLING_ROSTER_ADDON_TODO",
        validated: { teamId, requestedSlots },
        hint:
          "Use stripe.checkout.sessions.create with metadata.team_id; webhook updates subscriptions / program billing columns.",
        envOk: {
          stripeSecret: true,
          webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
      },
      { status: 501 }
    )
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify billing permission" }, { status: 500 })
    }
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST /api/billing/roster-add-on]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
