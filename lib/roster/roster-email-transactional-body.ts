function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Short HTML + plain text for roster emails (roster is in the attachment). */
export function buildRosterTransactionalEmailBodies(teamName: string, optionalNote?: string): { htmlBody: string; textBody: string } {
  const note = optionalNote?.trim()
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;line-height:1.5;margin:20px">
<p>Hello,</p>
<p>Please find the roster for <strong>${esc(teamName)}</strong> attached.</p>
${
  note
    ? `<p style="margin-top:16px;white-space:pre-wrap;color:#334155;border-left:4px solid #2563eb;padding-left:12px">${esc(note).replace(/\n/g, "<br/>")}</p>`
    : ""
}
<p style="margin-top:24px;color:#64748b;font-size:13px">Thank you,<br/>Braik</p>
</body>
</html>`
  const text = [
    "Hello,",
    "",
    `Please find the roster for ${teamName} attached.`,
    ...(note ? ["", note] : []),
    "",
    "Thank you,",
    "Braik",
  ].join("\n")
  return { htmlBody: html, textBody: text }
}
