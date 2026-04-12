import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { RosterPrintPayload } from "@/lib/roster/roster-print-payload"

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const LINE = 11
const HEADER_SIZE = 9

/**
 * Build a simple letter-sized PDF roster table (preferred email attachment format).
 */
export async function buildRosterPdfBytes(payload: RosterPrintPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { team, template, players, generatedAt } = payload
  const tb = template.body

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const draw = (text: string, x: number, size: number, bold = false, color = rgb(0, 0, 0)) => {
    const f = bold ? fontBold : font
    const t = text.length > 120 ? `${text.slice(0, 117)}...` : text
    page.drawText(t, { x, y, size, font: f, color })
  }

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }

  const ensureSpace = (lines: number) => {
    if (y < MARGIN + lines * LINE) newPage()
  }

  draw(team.name, MARGIN, 16, true)
  y -= 20

  const meta: string[] = []
  if (template.header.showYear) meta.push(`${template.header.yearLabel}: ${team.year}`)
  if (template.header.showSchoolName && team.schoolName) meta.push(`${template.header.schoolNameLabel}: ${team.schoolName}`)
  if (meta.length) {
    draw(meta.join("  ·  "), MARGIN, 10, false, rgb(0.25, 0.25, 0.25))
    y -= 14
  }

  y -= 8

  const cols: { label: string; width: number; get: (p: (typeof players)[0]) => string }[] = []
  if (tb.showJerseyNumber) cols.push({ label: tb.jerseyNumberLabel, width: 36, get: (p) => String(p.jerseyNumber ?? "") })
  if (tb.showPlayerName) cols.push({ label: tb.playerNameLabel, width: 140, get: (p) => p.name })
  if (tb.showGrade) cols.push({ label: tb.gradeLabel, width: 44, get: (p) => String(p.gradeLabel ?? p.grade ?? "") })
  if (tb.showPosition !== false) cols.push({ label: tb.positionLabel ?? "Pos", width: 52, get: (p) => p.position ?? "" })
  if (tb.showWeight !== false) cols.push({ label: tb.weightLabel ?? "Wt", width: 44, get: (p) => (p.weight != null ? String(p.weight) : "") })
  if (tb.showHeight !== false) cols.push({ label: tb.heightLabel ?? "Ht", width: 52, get: (p) => p.height ?? "" })

  const totalW = cols.reduce((s, c) => s + c.width, 0)
  let x0 = MARGIN
  if (totalW > PAGE_W - 2 * MARGIN) {
    const scale = (PAGE_W - 2 * MARGIN) / totalW
    for (const c of cols) c.width = Math.floor(c.width * scale)
  }

  ensureSpace(3)
  x0 = MARGIN
  for (const c of cols) {
    draw(c.label, x0, HEADER_SIZE, true)
    x0 += c.width
  }
  y -= HEADER_SIZE + 6
  page.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: PAGE_W - MARGIN, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
  y -= 6

  for (const p of players) {
    ensureSpace(2)
    x0 = MARGIN
    for (const c of cols) {
      draw(c.get(p), x0, 9, false)
      x0 += c.width
    }
    y -= LINE + 2
  }

  y -= 10
  ensureSpace(3)
  if (template.footer.showGeneratedDate) {
    draw(`Generated: ${new Date(generatedAt).toLocaleDateString()}`, MARGIN, 8, false, rgb(0.4, 0.4, 0.4))
    y -= 12
  }
  if (template.footer.customText?.trim()) {
    draw(template.footer.customText.trim(), MARGIN, 8, false, rgb(0.4, 0.4, 0.4))
  }

  return pdf.save()
}
