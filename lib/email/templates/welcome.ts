export type WelcomeTemplateInput = {
  displayName: string
  appUrl?: string
}

export function buildWelcomeSubject(): string {
  return "Welcome to Braik"
}

export function buildWelcomeTextBody(input: WelcomeTemplateInput): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""
  const url = input.appUrl ?? (base ? `${base.replace(/\/$/, "")}/dashboard` : "/dashboard")
  return [
    `Hi ${input.displayName},`,
    "",
    "Welcome to Braik — your home for team operations.",
    "",
    `Open the app: ${url}`,
    "",
    "— Braik",
  ].join("\n")
}

export function buildWelcomeHtmlBody(input: WelcomeTemplateInput): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""
  const url = input.appUrl ?? (base ? `${base.replace(/\/$/, "")}/dashboard` : "/dashboard")
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<p>Hi ${safe(input.displayName)},</p>
<p>Welcome to Braik — your home for team operations.</p>
<p><a href="${safe(url)}" style="color:#2563eb;">Open the app</a></p>
<p style="color:#64748b;font-size:14px;">— Braik</p>
</body></html>`
}
