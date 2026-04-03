/**
 * Detects when the user is asking to put something on the calendar (practice, workout, etc.)
 * with a time — not merely to send a notification.
 * Used to force create_event instead of send_notification / send_team_message.
 */
export function isLikelyCalendarSchedulingRequest(message: string): boolean {
  const m = message.trim().toLowerCase()
  if (m.length < 8) return false

  const hasExplicitCalendarVerb = /\b(add|create|put|schedule|set up|book)\b/i.test(m)
  if (
    /^(notify|send (a |the )?(message|text)|text|email|announce|remind|tell)\b/i.test(m) &&
    !hasExplicitCalendarVerb &&
    !/\b(on the calendar|calendar event)\b/.test(m)
  ) {
    return false
  }

  const looksNotifyOnly =
    /^(notify|send (a |the )?(message|text)|text|email|announce|remind)\b/i.test(m) &&
    !/\b(practice|workout|meeting|scrimmage|calendar|schedule (an |a )?event)\b/i.test(m)
  if (looksNotifyOnly) return false

  const hasTime =
    /\b(today|tomorrow|tonight|next (mon|tue|wed|thu|fri|sat|sun)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      m,
    ) ||
    /\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(m) ||
    /\bat\s+\d{1,2}/i.test(m)

  const hasScheduleNoun =
    /\b(practice|workout|meeting|scrimmage|lift|film(\s+session)?)\b/.test(m) ||
    /\b(add|create|put|schedule|set up)\b.*\b(event)\b/i.test(m)

  const hasCalendarIntent =
    /\b(add|create|put|schedule|set up|book)\b.*\b(practice|workout|meeting|scrimmage|event)\b/i.test(m) ||
    /\b(practice|workout)\b.*\b(for|at|on|today|tomorrow|\d)/i.test(m) ||
    /\b(on the calendar|to the calendar|calendar event)\b/i.test(m)

  const hasLocationOrField = /\b(at|on)\s+[\w\s]+(field|stadium|gym|track|turf)\b/i.test(m) || /\bcarver\b/i.test(m)

  if (!hasTime) return false
  if (!hasScheduleNoun && !/\b(event|calendar)\b/.test(m)) return false

  return hasCalendarIntent || hasLocationOrField || /\b(practice|workout)\b/.test(m)
}

/** Looser match for retry when the model proposed notify instead of create_event. */
export function isLooseCalendarSchedulingHint(message: string): boolean {
  const m = message.trim().toLowerCase()
  if (m.length < 6) return false
  const hasTopic = /\b(practice|workout|scrimmage|meeting)\b/.test(m)
  const hasTime =
    /\b(today|tomorrow|tonight)\b/i.test(m) ||
    /\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(m) ||
    /\bat\s+\d{1,2}/i.test(m)
  return hasTopic && hasTime
}
