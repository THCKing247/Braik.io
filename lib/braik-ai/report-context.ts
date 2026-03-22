import type { ContextModuleInput, ReportContext } from "./types"

const EXCERPT_CAP = 2500
const MAX_REPORTS = 5
const MAX_CHUNKS = 3
const MAX_METADATA_ONLY = 2

/** Chunk size for fixed-size fallback; overlap to avoid cutting mid-sentence. */
const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 100
const MAX_PARAGRAPH_LENGTH = 600
const MIN_CHUNK_LENGTH = 80

/**
 * Keyword categories: phrase in user message → terms that boost relevance when found in doc/chunk.
 */
const DOCUMENT_KEYWORDS: Record<string, string[]> = {
  "injury report": ["injury", "injuries", "report", "health", "availability", "out", "questionable", "doubtful", "limited", "return"],
  "practice plan": ["practice", "plan", "practice plan", "reps", "drills", "schedule", "period", "individual", "team"],
  "scouting report": ["scouting", "scout", "opponent", "tendencies", "film", "breakdown", "coverage", "blitz", "formation"],
  schedule: ["schedule", "calendar", "game", "opponent", "date", "week", "time", "location"],
  opponent: ["opponent", "vs", "matchup", "scouting", "game", "defense", "offense"],
  "depth chart": ["depth", "chart", "string", "starter", "backup", "roster", "position"],
  "game plan": ["game plan", "gameplan", "plan", "strategy", "tendencies", "opponent", "keys"],
}

const SPECIFIC_DOC_PATTERNS = [
  /the\s+injury\s+report/i,
  /the\s+practice\s+plan/i,
  /the\s+scouting\s+report/i,
  /the\s+(uploaded\s+)?schedule/i,
  /the\s+game\s+plan/i,
  /the\s+depth\s+chart/i,
  /what\s+does\s+the\s+.+\s+(say|show)/i,
  /summarize\s+the\s+.+(\s+report)?/i,
]

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

// ─── Chunking ─────────────────────────────────────────────────────────────

/**
 * Split text into chunks: paragraph-based first, then fixed-size with overlap for long paragraphs.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []

  for (const para of paragraphs) {
    if (para.length <= MAX_PARAGRAPH_LENGTH) {
      if (para.length >= MIN_CHUNK_LENGTH) chunks.push(para)
      continue
    }
    for (let i = 0; i < para.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const slice = para.slice(i, i + CHUNK_SIZE).trim()
      if (slice.length >= MIN_CHUNK_LENGTH) chunks.push(slice)
      if (i + CHUNK_SIZE >= para.length) break
    }
  }

  if (chunks.length === 0 && trimmed.length >= MIN_CHUNK_LENGTH) {
    chunks.push(trimmed.slice(0, CHUNK_SIZE))
  }
  return chunks
}

// ─── Document-level scoring ───────────────────────────────────────────────

function scoreDocument(report: ReportContext, message: string): number {
  const lower = message.toLowerCase().trim()
  const msgTokens = new Set(tokenize(message))
  const searchable = [report.source, report.type ?? "", report.excerpt.slice(0, 800)].join(" ").toLowerCase()

  let score = 0
  for (const t of msgTokens) {
    if (t.length < 2) continue
    if (searchable.includes(t)) score += 2
  }
  for (const [phrase, terms] of Object.entries(DOCUMENT_KEYWORDS)) {
    if (!lower.includes(phrase)) continue
    for (const term of terms) {
      if (searchable.includes(term)) {
        score += 5
        break
      }
    }
  }
  const isSpecificQuery = SPECIFIC_DOC_PATTERNS.some((re) => re.test(message))
  if (isSpecificQuery) {
    for (const [phrase] of Object.entries(DOCUMENT_KEYWORDS)) {
      if (!lower.includes(phrase)) continue
      const terms = DOCUMENT_KEYWORDS[phrase]
      let matchCount = 0
      for (const term of terms) {
        if (searchable.includes(term)) matchCount++
      }
      if (matchCount > 0) score += 10 + matchCount * 3
    }
    const titlePart = (report.source + " " + (report.type ?? "")).toLowerCase()
    for (const t of msgTokens) {
      if (t.length >= 3 && titlePart.includes(t)) score += 4
    }
  }
  if (report.hasExtractedText && /\b(summarize|say|show|content|key\s+points|pull\s+out)\b/i.test(message)) {
    score += 6
  }
  if (report.hasExtractedText) score += 0.5
  return score
}

// ─── Chunk-level scoring ─────────────────────────────────────────────────

/**
 * Score a single chunk of text against the user message.
 * Same signals: token overlap, keyword category, specific-document phrases.
 * Dense relevance (many matches in a short chunk) is preferred.
 */
function scoreChunk(chunkText: string, message: string): number {
  const lower = message.toLowerCase().trim()
  const chunkLower = chunkText.toLowerCase()
  const msgTokens = new Set(tokenize(message))

  let score = 0

  for (const t of msgTokens) {
    if (t.length < 2) continue
    if (chunkLower.includes(t)) score += 2
  }

  for (const [phrase, terms] of Object.entries(DOCUMENT_KEYWORDS)) {
    if (!lower.includes(phrase)) continue
    for (const term of terms) {
      if (chunkLower.includes(term)) {
        score += 5
        break
      }
    }
  }

  const isSpecificQuery = SPECIFIC_DOC_PATTERNS.some((re) => re.test(message))
  if (isSpecificQuery) {
    for (const [phrase, terms] of Object.entries(DOCUMENT_KEYWORDS)) {
      if (!lower.includes(phrase)) continue
      let matchCount = 0
      for (const term of terms) {
        if (chunkLower.includes(term)) matchCount++
      }
      if (matchCount > 0) score += 10 + matchCount * 3
    }
  }

  return score
}

// ─── Main: fetch, rank docs, rank chunks, build result ────────────────────

export async function getReportContext(input: ContextModuleInput): Promise<ReportContext[]> {
  const { teamId, message, supabase } = input
  const reports: ReportContext[] = []

  try {
    const { data: teamDocs, error: docErr } = await supabase
      .from("documents")
      .select("id, title, category, file_name, extracted_text")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!docErr && teamDocs?.length) {
      for (const d of teamDocs as Array<{ id: string; title: string; category: string; file_name: string; extracted_text?: string | null }>) {
        const hasText = !!d.extracted_text?.trim()
        const fullText = hasText ? d.extracted_text!.trim() : ""
        const excerpt = hasText ? fullText.slice(0, EXCERPT_CAP) : `${d.title} (${d.category ?? "other"})${d.file_name ? ` — ${d.file_name}` : ""}`
        reports.push({
          id: d.id,
          source: "Team document",
          excerpt,
          type: d.category ?? "other",
          hasExtractedText: hasText,
        })
      }
    }
  } catch {
    //
  }

  try {
    const { data: playerDocs, error: pdErr } = await supabase
      .from("player_documents")
      .select("id, title, category, document_type, file_name, extracted_text")
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30)

    if (!pdErr && playerDocs?.length) {
      for (const d of playerDocs as Array<{
        id: string
        title: string
        category: string
        document_type?: string | null
        file_name: string
        extracted_text?: string | null
      }>) {
        const hasText = !!d.extracted_text?.trim()
        const fullText = hasText ? d.extracted_text!.trim() : ""
        const cat = d.document_type || d.category || "other"
        const excerpt = hasText ? fullText.slice(0, EXCERPT_CAP) : `${d.title} (${cat})${d.file_name ? ` — ${d.file_name}` : ""}`
        reports.push({
          id: d.id,
          source: "Player document",
          excerpt,
          type: cat,
          hasExtractedText: hasText,
        })
      }
    }
  } catch {
    //
  }

  if (reports.length === 0) return reports

  const docScored = reports.map((r) => ({ report: r, score: scoreDocument(r, message) }))
  docScored.sort((a, b) => b.score - a.score)
  const topDocs = docScored.slice(0, MAX_REPORTS)

  const withText = topDocs.filter((d) => d.report.hasExtractedText)
  const metadataOnly = topDocs.filter((d) => !d.report.hasExtractedText)

  const chunkCandidates: Array<{ report: ReportContext; chunk: string; score: number }> = []
  for (const { report } of withText) {
    const chunks = chunkText(report.excerpt)
    for (const chunk of chunks) {
      const score = scoreChunk(chunk, message)
      chunkCandidates.push({ report, chunk, score })
    }
  }

  chunkCandidates.sort((a, b) => b.score - a.score)
  const bestChunks = chunkCandidates.slice(0, MAX_CHUNKS)

  const result: ReportContext[] = []
  for (const { report, chunk } of bestChunks) {
    result.push({
      id: report.id,
      source: report.source,
      excerpt: chunk,
      type: report.type ?? "other",
      hasExtractedText: true,
    })
  }

  for (const { report } of metadataOnly.slice(0, MAX_METADATA_ONLY)) {
    result.push({
      id: report.id,
      source: report.source,
      excerpt: report.excerpt,
      type: report.type ?? "other",
      hasExtractedText: false,
    })
  }

  return result
}
