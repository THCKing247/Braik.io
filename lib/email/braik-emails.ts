/**
 * Braik transactional email flows — all server-side.
 * Uses Postmark via {@link sendEmail}; swap internals for template aliases later.
 */

import { sendEmail, type EmailSendResult } from "@/lib/email/postmark"
import { getPostmarkSupportEmail } from "@/lib/email/postmark-config"
import {
  buildPlayerInviteHtmlBody,
  buildPlayerInviteSubject,
  buildPlayerInviteTextBody,
  type PlayerInviteTemplateInput,
} from "@/lib/email/templates/player-invite"
import {
  buildTeamInviteHtmlBody,
  buildTeamInviteSubject,
  buildTeamInviteTextBody,
  type TeamInviteTemplateInput,
} from "@/lib/email/templates/team-invite"
import { buildWelcomeHtmlBody, buildWelcomeSubject, buildWelcomeTextBody, type WelcomeTemplateInput } from "@/lib/email/templates/welcome"
import { buildNotificationHtmlBody } from "@/lib/email/templates/notification"

export type { EmailSendResult }

export async function sendPlayerInviteEmail(
  args: PlayerInviteTemplateInput & { to: string; metadata?: Record<string, string> }
): Promise<EmailSendResult> {
  const { to, metadata, ...rest } = args
  return sendEmail({
    to,
    subject: buildPlayerInviteSubject(),
    htmlBody: buildPlayerInviteHtmlBody(rest),
    textBody: buildPlayerInviteTextBody(rest),
    tag: "player-invite",
    metadata,
  })
}

/** Parent/guardian-facing copy — same join mechanics, distinct tagging for analytics. */
export async function sendParentInviteEmail(
  args: PlayerInviteTemplateInput & { to: string; metadata?: Record<string, string> }
): Promise<EmailSendResult> {
  const { to, metadata, ...rest } = args
  return sendEmail({
    to,
    subject: `Parent: ${buildPlayerInviteSubject()}`,
    htmlBody: buildPlayerInviteHtmlBody(rest),
    textBody: buildPlayerInviteTextBody(rest),
    tag: "parent-invite",
    metadata: { ...metadata, audience: "parent" },
  })
}

export async function sendTeamInviteEmail(
  args: TeamInviteTemplateInput & { to: string; metadata?: Record<string, string> }
): Promise<EmailSendResult> {
  const { to, teamName, metadata, ...rest } = args
  return sendEmail({
    to,
    subject: buildTeamInviteSubject(teamName),
    htmlBody: buildTeamInviteHtmlBody({ teamName, ...rest }),
    textBody: buildTeamInviteTextBody({ teamName, ...rest }),
    tag: "team-invite",
    metadata,
  })
}

export async function sendWelcomeEmail(
  args: WelcomeTemplateInput & { to: string; metadata?: Record<string, string> }
): Promise<EmailSendResult> {
  const { to, metadata, ...rest } = args
  return sendEmail({
    to,
    subject: buildWelcomeSubject(),
    htmlBody: buildWelcomeHtmlBody(rest),
    textBody: buildWelcomeTextBody(rest),
    tag: "welcome",
    metadata,
  })
}

export type NotificationEmailArgs = {
  to: string
  subject: string
  /** Plain text fallback */
  textBody: string
  /** HTML fragment (wrapped in layout) or full HTML if starts with <!DOCTYPE */
  bodyHtml: string
  tag?: string
  metadata?: Record<string, string>
}

export async function sendNotificationEmail(args: NotificationEmailArgs): Promise<EmailSendResult> {
  const html =
    args.bodyHtml.trim().startsWith("<!DOCTYPE") || args.bodyHtml.trim().startsWith("<html")
      ? args.bodyHtml
      : buildNotificationHtmlBody(args.subject, args.bodyHtml)

  const support = getPostmarkSupportEmail()
  const text =
    support && !args.textBody.includes(support)
      ? `${args.textBody}\n\n—\nSupport: ${support}`
      : args.textBody

  return sendEmail({
    to: args.to,
    subject: args.subject,
    htmlBody: html,
    textBody: text,
    tag: args.tag ?? "notification",
    metadata: args.metadata,
  })
}
