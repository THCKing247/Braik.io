/**
 * Player roster invite content — easy to swap for Postmark templates later.
 */

export type PlayerInviteTemplateInput = {
  playerName: string
  joinLink: string
  code?: string | null
}

export function buildPlayerInviteSubject(): string {
  return "You've been invited to join Braik"
}

export function buildPlayerInviteTextBody(input: PlayerInviteTemplateInput): string {
  const lines = [
    `Hi ${input.playerName},`,
    "",
    "You've been invited to join your team on Braik.",
    "",
    `Join here: ${input.joinLink}`,
  ]
  if (input.code) lines.push("", `Or enter this code in the app: ${input.code}`)
  lines.push("", "If you didn't expect this invite, you can ignore this email.")
  return lines.join("\n")
}

export function buildPlayerInviteHtmlBody(input: PlayerInviteTemplateInput): string {
  const codeBlock = input.code
    ? `<p style="margin:16px 0;">Or enter this code in the app: <strong>${escapeHtml(input.code)}</strong></p>`
    : ""
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<p>Hi ${escapeHtml(input.playerName)},</p>
<p>You've been invited to join your team on Braik.</p>
<p style="margin:16px 0;"><a href="${escapeAttr(input.joinLink)}" style="color:#2563eb;">Join Braik</a></p>
${codeBlock}
<p style="color:#64748b;font-size:14px;">If you didn't expect this invite, you can ignore this email.</p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;")
}
