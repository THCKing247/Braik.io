import type { SupabaseClient } from "@supabase/supabase-js"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { emptyProductHealth, type ProductHealthSnapshot } from "@/lib/admin/product-health-types"

const PROFILE_ROLES = [
  "head_coach",
  "assistant_coach",
  "player",
  "parent",
  "athletic_director",
  "school_admin",
  "admin",
] as const

export async function loadProductHealthSnapshot(
  supabase: SupabaseClient,
  sinceIso: string
): Promise<ProductHealthSnapshot> {
  return safeAdminDbQuery(async () => {
    const [
      orgRes,
      progRes,
      rosterCapRes,
      coachBRes,
      feedbackRes,
      pendingRemRes,
      injuryRes,
      playbookRes,
      threadsRes,
      messagesRes,
      subsActiveRes,
      subsPastDueRes,
    ] = await Promise.all([
      supabase.from("organizations").select("*", { count: "exact", head: true }),
      supabase.from("programs").select("*", { count: "exact", head: true }),
      supabase.from("teams").select("*", { count: "exact", head: true }).not("roster_slot_limit", "is", null),
      supabase
        .from("product_events")
        .select("*", { count: "exact", head: true })
        .like("event_name", "braik.coach_b.%")
        .gte("created_at", sinceIso),
      supabase.from("user_feedback").select("*", { count: "exact", head: true }).gte("created_at", sinceIso),
      supabase
        .from("internal_reminder_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("player_injuries").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("playbooks").select("*", { count: "exact", head: true }),
      supabase
        .from("message_threads")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", sinceIso),
      supabase.from("messages").select("*", { count: "exact", head: true }).gte("created_at", sinceIso),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).in("status", ["active", "trialing"]),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "past_due"),
    ])

    const usersByRole: { role: string; count: number }[] = []
    for (const r of PROFILE_ROLES) {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", r)
      const n = count ?? 0
      if (n > 0) {
        usersByRole.push({ role: r, count: n })
      }
    }

    const { data: signupRows } = await supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(8)

    const recentSignups = (signupRows ?? []).map((row: { id: string; full_name?: string | null; created_at: string }) => ({
      id: row.id,
      createdAt: row.created_at,
      label: (row.full_name?.trim() || row.id).slice(0, 80),
    }))

    const { data: fbRows } = await supabase
      .from("user_feedback")
      .select("id, category, body, created_at")
      .order("created_at", { ascending: false })
      .limit(6)

    const recentFeedback = (fbRows ?? []).map(
      (row: { id: string; category: string; body: string; created_at: string }) => ({
        id: row.id,
        category: row.category,
        createdAt: row.created_at,
        preview: (row.body ?? "").slice(0, 120),
      })
    )

    return {
      organizations: orgRes.count ?? 0,
      programs: progRes.count ?? 0,
      teamsWithRosterCap: rosterCapRes.count ?? 0,
      coachBEventsInWindow: coachBRes.count ?? 0,
      feedbackInWindow: feedbackRes.count ?? 0,
      remindersPending: pendingRemRes.count ?? 0,
      injuriesActive: injuryRes.count ?? 0,
      playbooksTotal: playbookRes.count ?? 0,
      threadsTouchedInWindow: threadsRes.count ?? 0,
      messagesInWindow: messagesRes.count ?? 0,
      subscriptionsActive: subsActiveRes.count ?? 0,
      subscriptionsPastDue: subsPastDueRes.count ?? 0,
      usersByRole,
      recentSignups,
      recentFeedback,
    }
  }, emptyProductHealth)
}
