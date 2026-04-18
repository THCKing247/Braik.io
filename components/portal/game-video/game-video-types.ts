export type GameVideoRow = {
  id: string
  title: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
  upload_status?: string | null
  processing_status?: string | null
  created_at?: string | null
  /** When true, hidden from public/recruiter recruiting surfaces. */
  is_private?: boolean | null
  /** From coach GET single video — roster players linked to full film. */
  attachedPlayerIds?: string[]
}

export type ClipMetadata = {
  categories?: Record<string, string>
  ai?: { source?: string; generatedAt?: string }
}

export type ClipRow = {
  id: string
  start_ms: number
  end_ms: number
  duration_ms?: number | null
  title?: string | null
  description?: string | null
  tags?: string[] | null
  share_token?: string | null
  metadata?: ClipMetadata | null
  created_at?: string | null
  is_private?: boolean | null
  /** Roster players this clip is attached to (recruiting + player portal). */
  attachedPlayerIds?: string[]
}

/** Clip with parent film info for team-wide library browse */
export type ClipLibraryRow = ClipRow & {
  game_video_id: string
  film_title: string | null
  is_private?: boolean | null
}

/** Values collected before upload — passed through init → `game_videos` row. */
export type FilmUploadMeta = {
  /** Omit or whitespace-only → server uses filename stem fallback for `title`. */
  title?: string
  isPrivate: boolean
  tags?: string[]
  opponent?: string
  category?: string
  /** ISO date string `YYYY-MM-DD` when set */
  gameDate?: string | null
}

export type UploadUiState = {
  phase: "preparing" | "uploading" | "finalizing" | "success"
  pct: number
  fileName: string
  /** Coach-facing title shown during upload; mirrors DB title when custom title was sent. */
  displayTitle?: string
}
