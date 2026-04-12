import type { RosterPrintPayload } from "@/lib/roster/roster-print-payload"
import { formatSchoolDisplayName } from "@/lib/roster/roster-document-format"

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
  const schoolLine = team.schoolName ? formatSchoolDisplayName(team.schoolName) : ""

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; font-size: 14px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 12px 0; font-size: 26px; font-weight: bold; color: #111; letter-spacing: -0.02em; }
        .meta { margin: 0; color: #444; font-size: 14px; line-height: 1.5; }
        .meta strong { color: #222; }
        .sep { color: #bbb; margin: 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; table-layout: fixed; font-size: 13px; }
        th, td { padding: 8px 10px; border: 1px solid #ccc; vertical-align: middle; word-wrap: break-word; }
        th { background-color: #f0f0f0; font-weight: bold; color: #111; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        tr:nth-child(even) td { background-color: #f9fafb; }
        .num { text-align: center; font-variant-numeric: tabular-nums; }
        .name { text-align: left; }
        .grade { text-align: left; white-space: nowrap; }
        .pos { text-align: center; font-weight: 600; white-space: nowrap; }
        .wt { text-align: right; font-variant-numeric: tabular-nums; }
        .ht { text-align: center; white-space: nowrap; }
        .footer { margin-top: 24px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
  `

  if (template.header.showTeamName) {
    html += `<h1>${esc(team.name)}</h1>`
  }

  if (template.header.showYear || (template.header.showSchoolName && schoolLine)) {
    html += `<p class="meta">`
    if (template.header.showYear) {
      html += `<strong>${esc(template.header.yearLabel)}:</strong> ${esc(team.year)}`
    }
    if (template.header.showYear && template.header.showSchoolName && schoolLine) {
      html += `<span class="sep">|</span>`
    }
    if (template.header.showSchoolName && schoolLine) {
      html += `<strong>${esc(template.header.schoolNameLabel)}:</strong> ${esc(schoolLine)}`
    }
    html += `</p>`
  }

  html += `</div>`

  if (customMessage.trim()) {
    html += `<div style="margin-bottom:20px;padding:12px 16px;background:#f8fafc;border-left:4px solid #2563eb;">`
    html += `<p style="margin:0;color:#334155;white-space:pre-wrap;">${esc(customMessage.trim()).replace(/\n/g, "<br/>")}</p>`
    html += `</div>`
  }

  html += `<table><thead><tr>`

  if (template.body.showJerseyNumber) {
    html += `<th class="num" style="width:8%">${esc(template.body.jerseyNumberLabel)}</th>`
  }
  if (template.body.showPlayerName) {
    html += `<th class="name" style="width:28%">${esc(template.body.playerNameLabel)}</th>`
  }
  if (template.body.showGrade) {
    html += `<th class="grade" style="width:14%">${esc(template.body.gradeLabel)}</th>`
  }
  if (template.body.showPosition !== false) {
    html += `<th class="pos" style="width:10%">${esc(template.body.positionLabel ?? "Position")}</th>`
  }
  if (template.body.showWeight !== false) {
    html += `<th class="wt" style="width:10%">${esc(template.body.weightLabel ?? "Weight")}</th>`
  }
  if (template.body.showHeight !== false) {
    html += `<th class="ht" style="width:10%">${esc(template.body.heightLabel ?? "Height")}</th>`
  }

  html += `</tr></thead><tbody>`

  for (const player of players) {
    html += `<tr>`
    if (template.body.showJerseyNumber) {
      html += `<td class="num">${esc(player.jerseyNumber ?? "")}</td>`
    }
    if (template.body.showPlayerName) {
      html += `<td class="name">${esc(player.name)}</td>`
    }
    if (template.body.showGrade) {
      html += `<td class="grade">${esc(player.gradeLabel ?? player.grade ?? "")}</td>`
    }
    if (template.body.showPosition !== false) {
      html += `<td class="pos">${esc(player.position ?? "")}</td>`
    }
    if (template.body.showWeight !== false) {
      html += `<td class="wt">${player.weight != null ? esc(player.weight) : ""}</td>`
    }
    if (template.body.showHeight !== false) {
      html += `<td class="ht">${esc(player.height ?? "")}</td>`
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
