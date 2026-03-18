import type { RosterPrintPayload } from "@/lib/roster/roster-print-payload"

function esc(s: string | number | null | undefined): string {
  if (s == null) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function generateRosterEmailHTML(
  data: Pick<RosterPrintPayload, "team" | "template" | "players" | "generatedAt">,
  customMessage: string = ""
): string {
  const { team, template, players, generatedAt } = data

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 8px 0; color: #111; }
        .header p { margin: 4px 0; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 10px; text-align: left; border: 1px solid #ccc; }
        th { background-color: #f0f0f0; font-weight: bold; color: #111; }
        .footer { margin-top: 24px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
  `

  if (template.header.showYear) {
    html += `<p><strong>${esc(template.header.yearLabel)}:</strong> ${esc(team.year)}</p>`
  }
  if (template.header.showSchoolName && team.schoolName) {
    html += `<p><strong>${esc(template.header.schoolNameLabel)}:</strong> ${esc(team.schoolName)}</p>`
  }
  if (template.header.showTeamName) {
    html += `<h1>${esc(team.name)}</h1>`
  }

  html += `</div>`

  if (customMessage.trim()) {
    html += `<div style="margin-bottom:20px;padding:12px 16px;background:#f8fafc;border-left:4px solid #2563eb;">`
    html += `<p style="margin:0;color:#334155;white-space:pre-wrap;">${esc(customMessage.trim()).replace(/\n/g, "<br/>")}</p>`
    html += `</div>`
  }

  html += `<table><thead><tr>`

  if (template.body.showJerseyNumber) {
    html += `<th>${esc(template.body.jerseyNumberLabel)}</th>`
  }
  if (template.body.showPlayerName) {
    html += `<th>${esc(template.body.playerNameLabel)}</th>`
  }
  if (template.body.showGrade) {
    html += `<th>${esc(template.body.gradeLabel)}</th>`
  }
  if (template.body.showPosition !== false) {
    html += `<th>${esc(template.body.positionLabel ?? "Position")}</th>`
  }
  if (template.body.showWeight !== false) {
    html += `<th>${esc(template.body.weightLabel ?? "Weight")}</th>`
  }
  if (template.body.showHeight !== false) {
    html += `<th>${esc(template.body.heightLabel ?? "Height")}</th>`
  }

  html += `</tr></thead><tbody>`

  for (const player of players) {
    html += `<tr>`
    if (template.body.showJerseyNumber) {
      html += `<td>${esc(player.jerseyNumber ?? "")}</td>`
    }
    if (template.body.showPlayerName) {
      html += `<td>${esc(player.name)}</td>`
    }
    if (template.body.showGrade) {
      html += `<td>${esc(player.gradeLabel ?? player.grade ?? "")}</td>`
    }
    if (template.body.showPosition !== false) {
      html += `<td>${esc(player.position ?? "")}</td>`
    }
    if (template.body.showWeight !== false) {
      html += `<td>${player.weight != null ? esc(player.weight) : ""}</td>`
    }
    if (template.body.showHeight !== false) {
      html += `<td>${esc(player.height ?? "")}</td>`
    }
    html += `</tr>`
  }

  html += `</tbody></table>`

  if (template.footer.showGeneratedDate || template.footer.customText) {
    html += `<div class="footer">`
    if (template.footer.showGeneratedDate) {
      html += `<p>Generated: ${esc(new Date(generatedAt).toLocaleDateString())}</p>`
    }
    if (template.footer.customText) {
      html += `<p>${esc(template.footer.customText)}</p>`
    }
    html += `</div>`
  }

  html += `</body></html>`
  return html
}
