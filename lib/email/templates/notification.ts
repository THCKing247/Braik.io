/**
 * Generic announcement / notification — callers supply subject and body.
 */

export function buildNotificationHtmlBody(title: string, bodyHtml: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<h2 style="font-size:18px;margin:0 0 12px;">${safe(title)}</h2>
<div>${bodyHtml}</div>
</body></html>`
}
