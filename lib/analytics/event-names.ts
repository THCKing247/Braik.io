/**
 * Central catalog for product analytics. Prefer these constants at call sites.
 * Convention: braik.<domain>.<action> — keep payloads small; never put raw prompts or message bodies in metadata.
 */
export const BRAIK_EVENTS = {
  auth: {
    signup_completed: "braik.auth.signup_completed",
    parent_linked: "braik.auth.parent_linked",
  },
  onboarding: {
    completed: "braik.onboarding.completed",
  },
  roster: {
    player_created: "braik.roster.player_created",
    import_completed: "braik.roster.import_completed",
    limit_blocked: "braik.billing.roster_limit_blocked",
  },
  health: {
    injury_created: "braik.health.injury_created",
    injury_updated: "braik.health.injury_updated",
    injury_resolved: "braik.health.injury_resolved",
  },
  playbook: {
    created: "braik.playbook.created",
    updated: "braik.playbook.updated",
  },
  messaging: {
    message_sent: "braik.messaging.message_sent",
    thread_created: "braik.messaging.thread_created",
  },
  announcements: {
    posted: "braik.announcements.posted",
  },
  docs: {
    share_updated: "braik.docs.share_updated",
  },
  stats: {
    viewed: "braik.stats.viewed",
  },
  coach_b: {
    opened: "braik.coach_b.opened",
    prompt_submitted: "braik.coach_b.prompt_submitted",
    response_completed: "braik.coach_b.response_completed",
    response_error: "braik.coach_b.response_error",
    suggest_play_requested: "braik.coach_b.suggest_play_requested",
    suggest_play_draft_started: "braik.coach_b.suggest_play_draft_started",
    helpfulness: "braik.coach_b.helpfulness",
  },
  billing: {
    roster_addon_requested: "braik.billing.roster_addon_requested",
    stripe_webhook_subscription: "braik.billing.stripe_subscription_event",
    upgrade_prompt_shown: "braik.billing.upgrade_prompt_shown",
  },
} as const
