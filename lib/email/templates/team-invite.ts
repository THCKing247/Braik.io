export type TeamInviteTemplateInput = {
  teamName: string
  role: string
  inviteUrl: string
  /** Optional — shown when present */
  inviterName?: string | null
}

export function buildTeamInviteSubject(teamName: string): string {
  return `You're invited to join ${teamName} on Braik`
}

export function buildTeamInviteTextBody(input: TeamInviteTemplateInput): string {
  const inviter = input.inviterName?.trim()
  const lines = [
    "You've been invited to join a team on Braik.",
    "",
    `Team: ${input.teamName}`,
    `Role: ${input.role}`,
    "",
    `Accept your invitation: ${input.inviteUrl}`,
    "",
    "If you didn't expect this invitation, you can ignore this email.",
  ]
  if (inviter) lines.splice(1, 0, `Invited by: ${inviter}`, "")
  return lines.join("\n")
}

export function buildTeamInviteHtmlBody(input: TeamInviteTemplateInput): string {
  const inviter = input.inviterName?.trim()
  const inviterBlock = inviter
    ? `<p style="margin:8px 0;"><strong>Invited by:</strong> ${escapeHtml(inviter)}</p>`
    : ""
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<p>You've been invited to join a team on Braik.</p>
${inviterBlock}
<p style="margin:8px 0;"><strong>Team:</strong> ${escapeHtml(input.teamName)}</p>
<p style="margin:8px 0;"><strong>Role:</strong> ${escapeHtml(input.role)}</p>
<p style="margin:20px 0;"><a href="${escapeAttr(input.inviteUrl)}" style="color:#2563eb;font-weight:600;">Accept invitation</a></p>
<p style="color:#64748b;font-size:14px;">If you didn't expect this invitation, you can ignore this email.</p>
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
